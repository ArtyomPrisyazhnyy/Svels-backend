import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { USERS_SERVICE } from '../common/constants/injection-tokens';
import { UserRole } from '../common/enums/user-role.enum';
import type { IUsersService } from '../users/interfaces/users-service.interface';
import { UserCreatedEvent } from '../users/events/user-created.event';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleTokenService } from './google-token.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USERS_SERVICE)
    private readonly usersService: IUsersService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly googleTokenService: GoogleTokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create(
      { ...dto, role: UserRole.USER },
      passwordHash,
    );

    this.eventEmitter.emit('user.created', new UserCreatedEvent(user.id, user.email));

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Для этого аккаунта используйте вход через Google');
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
    const googleProfile = await this.googleTokenService.verifyIdToken(dto.idToken);
    const existing = await this.usersService.findByGoogleId(googleProfile.googleId);
    const user = await this.usersService.findOrCreateFromGoogle(googleProfile);

    if (!existing) {
      this.eventEmitter.emit('user.created', new UserCreatedEvent(user.id, user.email));
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: UserResponseDto): AuthResponseDto {
    const payload = { sub: user.id, email: user.email, role: user.role };
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

    return { accessToken, user: authUser };
  }
}
