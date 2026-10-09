import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHmac } from 'crypto';
import { Repository } from 'typeorm';
import { AuthProvider } from '../../common/enums/auth-provider.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { UserCreatedEvent } from '../../users/events/user-created.event';
import { IUsersService } from '../../users/interfaces/users-service.interface';
import { AuthService } from '../auth.service';
import { TelegramGuestLink } from './entities/telegram-guest-link.entity';
import { TelegramWebAppService } from './telegram-webapp.service';

const BOT_TOKEN = '123:TEST';
const RESTAURANT_ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const NOW_SEC = Math.floor(Date.now() / 1000);

function signInitData(user: unknown): string {
  const fields: Record<string, string> = {
    auth_date: String(NOW_SEC - 60),
    user: JSON.stringify(user),
  };
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();
  const dataCheckString = Object.entries(fields)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const hash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

function guestUser(overrides: Partial<UserResponseDto> = {}): UserResponseDto {
  return {
    id: 'user-1',
    email: `tg+${RESTAURANT_ID}+42@telegram.svels.local`,
    firstName: 'Ivan',
    lastName: '',
    role: UserRole.USER,
    authProvider: AuthProvider.LOCAL,
    restaurantId: RESTAURANT_ID,
    createdAt: new Date(0),
    ...overrides,
  };
}

async function captureError(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('expected promise to reject');
}

describe('TelegramWebAppService', () => {
  let linkRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let usersService: {
    findById: jest.Mock;
    createTelegramGuest: jest.Mock;
  };
  let restaurants: { ensureApproved: jest.Mock };
  let authService: { issueGuestSession: jest.Mock };
  let configService: { get: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let service: TelegramWebAppService;

  beforeEach(() => {
    linkRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findById: jest.fn().mockResolvedValue(null),
      createTelegramGuest: jest.fn().mockResolvedValue(guestUser()),
    };
    restaurants = { ensureApproved: jest.fn().mockResolvedValue({}) };
    authService = {
      issueGuestSession: jest.fn((user: UserResponseDto) => ({
        accessToken: 'token',
        user: { id: user.id, role: user.role },
      })),
    };
    configService = { get: jest.fn().mockReturnValue(BOT_TOKEN) };
    eventEmitter = { emit: jest.fn() };

    service = new TelegramWebAppService(
      usersService as unknown as IUsersService,
      restaurants,
      authService as unknown as AuthService,
      configService as unknown as ConfigService,
      eventEmitter as unknown as EventEmitter2,
      linkRepository as unknown as Repository<TelegramGuestLink>,
    );
  });

  const telegramUser = { id: 42, first_name: 'Ivan', username: 'ivan' };

  it('creates a guest and saves the telegram link on first login', async () => {
    const initData = signInitData(telegramUser);

    const result = await service.login(RESTAURANT_ID, initData);

    expect(restaurants.ensureApproved).toHaveBeenCalledWith(RESTAURANT_ID);
    expect(usersService.createTelegramGuest).toHaveBeenCalledWith(
      { telegramUserId: '42', firstName: 'Ivan', lastName: '' },
      RESTAURANT_ID,
    );
    expect(linkRepository.save).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_ID,
      telegramUserId: '42',
      userId: 'user-1',
      telegramUsername: 'ivan',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'user.created',
      expect.any(UserCreatedEvent),
    );
    expect(authService.issueGuestSession).toHaveBeenCalledWith(guestUser());
    expect(result.user.id).toBe('user-1');
  });

  it('returns the same guest on repeated login without creating a new one', async () => {
    linkRepository.findOne.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      telegramUserId: '42',
      userId: 'user-1',
    });
    usersService.findById.mockResolvedValue(guestUser());

    const result = await service.login(
      RESTAURANT_ID,
      signInitData(telegramUser),
    );

    expect(usersService.createTelegramGuest).not.toHaveBeenCalled();
    expect(linkRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(result.user.id).toBe('user-1');
  });

  it('recreates the guest when the linked user was deleted', async () => {
    linkRepository.findOne.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      telegramUserId: '42',
      userId: 'gone-user',
    });
    usersService.findById.mockResolvedValue(null);

    await service.login(RESTAURANT_ID, signInitData(telegramUser));

    expect(linkRepository.delete).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_ID,
      telegramUserId: '42',
    });
    expect(usersService.createTelegramGuest).toHaveBeenCalledTimes(1);
  });

  it('uses the already linked guest when the link insert races', async () => {
    linkRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      restaurantId: RESTAURANT_ID,
      telegramUserId: '42',
      userId: 'user-2',
    });
    linkRepository.save.mockRejectedValue({ code: '23505' });
    usersService.findById.mockResolvedValue(guestUser({ id: 'user-2' }));

    const result = await service.login(
      RESTAURANT_ID,
      signInitData(telegramUser),
    );

    expect(result.user.id).toBe('user-2');
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('returns 503 TELEGRAM_NOT_CONFIGURED when the bot token is empty', async () => {
    configService.get.mockReturnValue('');

    const error = await captureError(
      service.login(RESTAURANT_ID, signInitData(telegramUser)),
    );

    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toMatchObject({
      statusCode: 503,
      code: 'TELEGRAM_NOT_CONFIGURED',
    });
    expect(restaurants.ensureApproved).not.toHaveBeenCalled();
  });

  it('returns 400 TELEGRAM_USER_MISSING when user is absent', async () => {
    const initData = new URLSearchParams({
      auth_date: String(NOW_SEC - 60),
    });
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();
    const hash = createHmac('sha256', secretKey)
      .update(`auth_date=${NOW_SEC - 60}`)
      .digest('hex');
    initData.set('hash', hash);

    const error = await captureError(
      service.login(RESTAURANT_ID, initData.toString()),
    );

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      statusCode: 400,
      code: 'TELEGRAM_USER_MISSING',
    });
    expect(usersService.createTelegramGuest).not.toHaveBeenCalled();
  });

  it('returns 401 TELEGRAM_INIT_DATA_INVALID when the hash does not match', async () => {
    const initData = signInitData(telegramUser).replace('Ivan', 'Petr');

    const error = await captureError(service.login(RESTAURANT_ID, initData));

    expect(error.getStatus()).toBe(401);
    expect(error.getResponse()).toMatchObject({
      statusCode: 401,
      code: 'TELEGRAM_INIT_DATA_INVALID',
    });
  });
});
