import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  TELEGRAM_OTP_PROVIDER,
  USERS_SERVICE,
} from '../common/constants/injection-tokens';
import {
  getPhoneCountry,
  InvalidPhoneError,
  isValidPhone,
  maskPhone,
  normalizePhone,
  toE164,
} from '../common/utils/normalize-phone.util';
import { AuthResponseDto } from './dto/auth-response.dto';
import type { IUsersService } from '../users/interfaces/users-service.interface';
import { UserCreatedEvent } from '../users/events/user-created.event';
import { UserResponseDto } from '../users/dto/user-response.dto';
import type { ITelegramOtpProvider } from '../otp/interfaces/telegram-otp-provider.interface';
import { OtpStoreService } from '../otp/otp-store.service';
import { SmsRouterService } from '../otp/providers/sms-router.service';
import type {
  GuestOtpSendResponseDto,
  GuestOtpVerifyResponseDto,
} from '../otp/dto/guest-otp-response.dto';
import type {
  GuestOtpRegisterDto,
  GuestOtpSendDto,
  GuestOtpVerifyDto,
} from '../otp/dto/guest-otp.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleTokenService } from './google-token.service';
import { UserRole } from '../common/enums/user-role.enum';
import * as bcrypt from 'bcrypt';
import { PasswordSetService } from './password-set.service';
import { SetPasswordDto } from './dto/set-password.dto';

interface GuestRegistrationTokenPayload {
  typ: 'guest_reg';
  phone: string;
  restaurantId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly telegramWaitMs: number;

  constructor(
    @Inject(USERS_SERVICE)
    private readonly usersService: IUsersService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly googleTokenService: GoogleTokenService,
    private readonly otpStore: OtpStoreService,
    @Inject(TELEGRAM_OTP_PROVIDER)
    private readonly telegramOtp: ITelegramOtpProvider,
    private readonly smsRouter: SmsRouterService,
    private readonly configService: ConfigService,
    private readonly passwordSetService: PasswordSetService,
  ) {
    this.telegramWaitMs = this.configService.get<number>(
      'otp.telegramWaitMs',
      20_000,
    );
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create(
      { ...dto, role: UserRole.USER },
      passwordHash,
    );

    this.eventEmitter.emit(
      'user.created',
      new UserCreatedEvent(user.id, user.email),
    );

    return this.buildAuthResponse(user);
  }

  async setPassword(dto: SetPasswordDto): Promise<AuthResponseDto> {
    const record = await this.passwordSetService.findValidTokenRecord(
      dto.token,
    );
    this.passwordSetService.assertTokenUsable(record);

    const user = await this.usersService.findById(record!.userId);
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    const updated = await this.usersService.updatePassword(
      user.id,
      dto.password,
    );

    await this.passwordSetService.markUsed(record!.tokenHash);

    return this.buildAuthResponse(updated);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findPlatformUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Для этого аккаунта используйте вход через Google',
      );
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const profile = await this.usersService.findById(user.id);
    if (!profile) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return this.buildAuthResponse(profile);
  }

  async loginWithGoogle(dto: GoogleAuthDto): Promise<AuthResponseDto> {
    const googleProfile = await this.googleTokenService.verifyIdToken(
      dto.idToken,
    );
    const existing = await this.usersService.findByGoogleId(
      googleProfile.googleId,
    );
    const user = await this.usersService.findOrCreateFromGoogle(googleProfile);

    if (!existing) {
      this.eventEmitter.emit(
        'user.created',
        new UserCreatedEvent(user.id, user.email),
      );
    }

    return this.buildAuthResponse(user);
  }

  async sendGuestOtp(
    restaurantId: string,
    dto: GuestOtpSendDto,
  ): Promise<GuestOtpSendResponseDto> {
    const phone = this.parseGuestPhone(dto.phone);
    const existing = await this.otpStore.get(restaurantId, phone);
    this.otpStore.assertCanResend(existing);

    const code = this.otpStore.generateCode();
    const country = getPhoneCountry(phone);
    const phoneE164 = toE164(phone);
    const sendCount = (existing?.sendCount ?? 0) + 1;

    // Первая отправка: Telegram → SMS. Повтор (sendCount > 1 через resend) — только SMS.
    let channel: GuestOtpSendResponseDto['channel'] = 'sms';
    let telegramRequestId: string | undefined;

    if (sendCount === 1) {
      const tg = await this.telegramOtp.sendCode(phoneE164, code);
      if (tg.ok && tg.requestId) {
        const delivery = await this.telegramOtp.waitForDelivery(
          tg.requestId,
          this.telegramWaitMs,
        );
        if (delivery.delivered) {
          channel = 'telegram';
          telegramRequestId = tg.requestId;
          this.logger.log(
            `OTP via telegram country=${country} phone=***${phone.slice(-4)} cost_hint=gateway`,
          );
        } else {
          this.logger.log(
            `OTP telegram undelivered status=${delivery.status ?? 'timeout'} → SMS country=${country}`,
          );
        }
      } else {
        this.logger.log(
          `OTP telegram skip error=${tg.error ?? 'n/a'} → SMS country=${country}`,
        );
      }
    }

    if (channel !== 'telegram') {
      const sms = await this.smsRouter.sendOtp(phone, code);
      if (!sms.ok) {
        throw new ServiceUnavailableException(
          'Не удалось отправить код. Попробуйте позже',
        );
      }
      channel = sms.provider === 'dev' ? 'dev' : 'sms';
      this.logger.log(
        `OTP via ${channel} country=${country} provider=${sms.provider} phone=***${phone.slice(-4)}`,
      );
    }

    const record = this.otpStore.createRecord({
      restaurantId,
      phone,
      code,
      channel,
      country,
      sendCount,
      telegramRequestId,
    });
    await this.otpStore.save(record);

    return {
      maskedPhone: maskPhone(phone),
      channel,
      resendAvailableAt: record.resendAvailableAt,
      expiresAt: record.expiresAt,
    };
  }

  async resendGuestOtp(
    restaurantId: string,
    dto: GuestOtpSendDto,
  ): Promise<GuestOtpSendResponseDto> {
    const phone = this.parseGuestPhone(dto.phone);
    const existing = await this.otpStore.get(restaurantId, phone);
    this.otpStore.assertCanResend(existing);

    const code = this.otpStore.generateCode();
    const country = getPhoneCountry(phone);
    const sendCount = (existing?.sendCount ?? 0) + 1;

    // Повторная отправка — сразу SMS, без Telegram.
    const sms = await this.smsRouter.sendOtp(phone, code);
    if (!sms.ok) {
      throw new ServiceUnavailableException(
        'Не удалось отправить код. Попробуйте позже',
      );
    }

    const channel = sms.provider === 'dev' ? 'dev' : 'sms';
    this.logger.log(
      `OTP resend via ${channel} country=${country} provider=${sms.provider} phone=***${phone.slice(-4)}`,
    );

    const record = this.otpStore.createRecord({
      restaurantId,
      phone,
      code,
      channel,
      country,
      sendCount,
    });
    await this.otpStore.save(record);

    return {
      maskedPhone: maskPhone(phone),
      channel,
      resendAvailableAt: record.resendAvailableAt,
      expiresAt: record.expiresAt,
    };
  }

  async verifyGuestOtp(
    restaurantId: string,
    dto: GuestOtpVerifyDto,
  ): Promise<GuestOtpVerifyResponseDto> {
    const phone = this.parseGuestPhone(dto.phone);
    const record = await this.otpStore.verifyCode(
      restaurantId,
      phone,
      dto.code.trim(),
    );

    if (record.telegramRequestId) {
      void this.telegramOtp.reportCodeChecked(
        record.telegramRequestId,
        dto.code.trim(),
      );
    }

    await this.otpStore.delete(restaurantId, phone);

    const existing = await this.usersService.findGuestByPhoneAndRestaurant(
      phone,
      restaurantId,
    );
    if (existing) {
      const profile = await this.usersService.findById(existing.id);
      if (!profile) {
        throw new UnauthorizedException('Пользователь не найден');
      }
      const auth = this.buildAuthResponse(profile);
      return {
        status: 'authenticated',
        accessToken: auth.accessToken,
        user: auth.user,
      };
    }

    const registrationToken = this.jwtService.sign(
      {
        typ: 'guest_reg',
        phone,
        restaurantId,
      } satisfies GuestRegistrationTokenPayload,
      { expiresIn: 60 * 10 },
    );

    return {
      status: 'registration_required',
      registrationToken,
      maskedPhone: maskPhone(phone),
    };
  }

  async registerGuestWithOtp(
    restaurantId: string,
    dto: GuestOtpRegisterDto,
  ): Promise<AuthResponseDto> {
    let payload: GuestRegistrationTokenPayload;
    try {
      payload = this.jwtService.verify<GuestRegistrationTokenPayload>(
        dto.registrationToken,
      );
    } catch {
      throw new UnauthorizedException(
        'Сессия регистрации истекла. Подтвердите номер снова',
      );
    }

    if (payload.typ !== 'guest_reg' || payload.restaurantId !== restaurantId) {
      throw new UnauthorizedException('Некорректный токен регистрации');
    }

    const phone = payload.phone;
    if (!isValidPhone(phone)) {
      throw new BadRequestException('Некорректный номер телефона');
    }

    const existing = await this.usersService.findGuestByPhoneAndRestaurant(
      phone,
      restaurantId,
    );
    if (existing) {
      const profile = await this.usersService.findById(existing.id);
      if (!profile) {
        throw new UnauthorizedException('Пользователь не найден');
      }
      return this.buildAuthResponse(profile);
    }

    const user = await this.usersService.createGuest(
      {
        phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
      restaurantId,
    );

    this.eventEmitter.emit(
      'user.created',
      new UserCreatedEvent(user.id, user.email),
    );
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: UserResponseDto): AuthResponseDto {
    const payload: {
      sub: string;
      email: string;
      role: string;
      restaurantId?: string;
    } = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    if (user.restaurantId) {
      payload.restaurantId = user.restaurantId;
    }

    const accessToken = this.jwtService.sign(payload);

    const authUser: AuthResponseDto['user'] = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      authProvider: user.authProvider,
    };

    if (user.restaurantId) {
      authUser.restaurantId = user.restaurantId;
    }

    if (user.phone) {
      authUser.phone = user.phone;
    }

    return { accessToken, user: authUser };
  }

  private parseGuestPhone(raw: string): string {
    try {
      const phone = normalizePhone(raw);
      if (!isValidPhone(phone)) {
        throw new InvalidPhoneError();
      }
      return phone;
    } catch {
      throw new BadRequestException('Некорректный номер телефона');
    }
  }
}
