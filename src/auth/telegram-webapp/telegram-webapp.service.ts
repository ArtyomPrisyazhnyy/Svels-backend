import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RESTAURANTS_SERVICE,
  USERS_SERVICE,
} from '../../common/constants/injection-tokens';
import type { IUsersService } from '../../users/interfaces/users-service.interface';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { UserCreatedEvent } from '../../users/events/user-created.event';
import { AuthService } from '../auth.service';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { TelegramGuestLink } from './entities/telegram-guest-link.entity';
import type { RestaurantApprovalPort } from './interfaces/restaurant-approval.port';
import {
  TelegramWebAppUser,
  validateTelegramInitData,
} from './telegram-init-data.util';

const GUEST_NAME_MAX_LENGTH = 100;
const DEFAULT_GUEST_FIRST_NAME = 'Гость';
const TELEGRAM_USERNAME_MAX_LENGTH = 64;
const UNIQUE_VIOLATION_CODE = '23505';

export function telegramAuthError(
  status: HttpStatus,
  code: string,
  message: string,
): HttpException {
  const error =
    status === HttpStatus.SERVICE_UNAVAILABLE
      ? 'Service Unavailable'
      : status === HttpStatus.UNAUTHORIZED
        ? 'Unauthorized'
        : 'Bad Request';
  return new HttpException(
    { statusCode: status, message, error, code },
    status,
  );
}

@Injectable()
export class TelegramWebAppService {
  constructor(
    @Inject(USERS_SERVICE)
    private readonly usersService: IUsersService,
    @Inject(RESTAURANTS_SERVICE)
    private readonly restaurants: RestaurantApprovalPort,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(TelegramGuestLink)
    private readonly linkRepository: Repository<TelegramGuestLink>,
  ) {}

  async login(
    restaurantId: string,
    initData: string,
  ): Promise<AuthResponseDto> {
    const botToken = this.configService.get<string>('telegramBot.botToken', '');
    if (!botToken) {
      throw telegramAuthError(
        HttpStatus.SERVICE_UNAVAILABLE,
        'TELEGRAM_NOT_CONFIGURED',
        'Вход через Telegram не настроен',
      );
    }

    await this.restaurants.ensureApproved(restaurantId);

    const check = validateTelegramInitData(initData, botToken, Date.now());
    if (!check.ok) {
      throw check.reason === 'expired'
        ? telegramAuthError(
            HttpStatus.UNAUTHORIZED,
            'TELEGRAM_INIT_DATA_EXPIRED',
            'Сессия Telegram истекла, откройте приложение снова',
          )
        : telegramAuthError(
            HttpStatus.UNAUTHORIZED,
            'TELEGRAM_INIT_DATA_INVALID',
            'Некорректные данные Telegram',
          );
    }

    const tgUser = check.user;
    if (
      !tgUser ||
      typeof tgUser.id !== 'number' ||
      !Number.isFinite(tgUser.id)
    ) {
      throw telegramAuthError(
        HttpStatus.BAD_REQUEST,
        'TELEGRAM_USER_MISSING',
        'В данных Telegram нет пользователя',
      );
    }

    const telegramUserId = String(tgUser.id);
    const user =
      (await this.findExistingGuest(restaurantId, telegramUserId)) ??
      (await this.createLinkedGuest(restaurantId, telegramUserId, tgUser));

    return this.authService.issueGuestSession(user);
  }

  private async findExistingGuest(
    restaurantId: string,
    telegramUserId: string,
  ): Promise<UserResponseDto | null> {
    const link = await this.linkRepository.findOne({
      where: { restaurantId, telegramUserId },
    });
    if (!link) {
      return null;
    }

    const user = await this.usersService.findById(link.userId);
    if (user) {
      return user;
    }

    await this.linkRepository.delete({ restaurantId, telegramUserId });
    return null;
  }

  private async createLinkedGuest(
    restaurantId: string,
    telegramUserId: string,
    tgUser: TelegramWebAppUser,
  ): Promise<UserResponseDto> {
    let user: UserResponseDto;
    try {
      user = await this.usersService.createTelegramGuest(
        {
          telegramUserId,
          firstName: this.guestFirstName(tgUser),
          lastName: this.guestLastName(tgUser),
        },
        restaurantId,
      );
    } catch (error) {
      const raced = isUniqueViolation(error)
        ? await this.findExistingGuest(restaurantId, telegramUserId)
        : null;
      if (raced) {
        return raced;
      }
      throw error;
    }

    try {
      await this.linkRepository.save({
        restaurantId,
        telegramUserId,
        userId: user.id,
        telegramUsername: tgUser.username
          ? tgUser.username.slice(0, TELEGRAM_USERNAME_MAX_LENGTH)
          : null,
      });
    } catch (error) {
      const raced = isUniqueViolation(error)
        ? await this.findExistingGuest(restaurantId, telegramUserId)
        : null;
      if (raced) {
        return raced;
      }
      throw error;
    }

    this.eventEmitter.emit(
      'user.created',
      new UserCreatedEvent(user.id, user.email),
    );
    return user;
  }

  private guestFirstName(tgUser: TelegramWebAppUser): string {
    const name = tgUser.first_name?.trim() || DEFAULT_GUEST_FIRST_NAME;
    return name.slice(0, GUEST_NAME_MAX_LENGTH);
  }

  private guestLastName(tgUser: TelegramWebAppUser): string {
    return (tgUser.last_name?.trim() || '').slice(0, GUEST_NAME_MAX_LENGTH);
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const direct = (error as { code?: unknown }).code;
  const driver = (error as { driverError?: { code?: unknown } }).driverError
    ?.code;
  return direct === UNIQUE_VIOLATION_CODE || driver === UNIQUE_VIOLATION_CODE;
}
