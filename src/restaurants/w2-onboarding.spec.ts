jest.mock('../menu/utils/menu-item.util', () => ({
  normalizeModifierGroups: (value: unknown) => value,
  normalizeNutrition: (value: unknown) => value,
}));

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { PasswordSetService } from '../auth/password-set.service';
import { UserRole } from '../common/enums/user-role.enum';
import { MenuService } from '../menu/menu.service';
import { RestaurantsService } from './restaurants.service';
import type { IUsersService } from '../users/interfaces/users-service.interface';
import { GoogleTokenService } from '../auth/google-token.service';
import { OtpStoreService } from '../otp/otp-store.service';
import { SmsRouterService } from '../otp/providers/sms-router.service';

describe('W2-B-ONB onboarding', () => {
  describe('PasswordSetService', () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const tokensRepository = {
      delete: jest.fn().mockResolvedValue(undefined),
      save,
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const config = {
      get: (key: string, fallback?: unknown) => {
        if (key === 'setPassword.urlBase') {
          return 'https://app.test/auth/set-password';
        }
        if (key === 'setPassword.ttlHours') {
          return 24;
        }
        return fallback;
      },
    } as unknown as ConfigService;

    const service = new PasswordSetService(tokensRepository as never, config);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('issues token with sha256 hash stored and URL', async () => {
      const result = await service.issueForUser('owner-id');

      expect(result.setPasswordUrl).toContain(
        'https://app.test/auth/set-password',
      );
      expect(result.setPasswordUrl).toContain('token=');
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-id',
          usedAt: null,
        }),
      );
      expect(result.token.length).toBeGreaterThan(20);
    });

    it('rejects expired token', () => {
      expect(() =>
        service.assertTokenUsable({
          tokenHash: 'x',
          userId: 'u',
          expiresAt: new Date(Date.now() - 1000),
          usedAt: null,
          createdAt: new Date(),
        }),
      ).toThrow(UnauthorizedException);
    });

    it('rejects already used token', () => {
      expect(() =>
        service.assertTokenUsable({
          tokenHash: 'x',
          userId: 'u',
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: new Date(),
          createdAt: new Date(),
        }),
      ).toThrow(ConflictException);
    });
  });

  describe('AuthService.setPassword', () => {
    let authService: AuthService;
    let usersService: jest.Mocked<
      Pick<IUsersService, 'findById' | 'updatePassword'>
    >;
    let passwordSetService: jest.Mocked<
      Pick<PasswordSetService, 'findValidTokenRecord' | 'claimToken'>
    >;

    beforeEach(() => {
      usersService = {
        findById: jest.fn(),
        updatePassword: jest.fn(),
      };

      passwordSetService = {
        findValidTokenRecord: jest.fn(),
        claimToken: jest.fn().mockResolvedValue(true),
      };

      const jwtService = { sign: jest.fn().mockReturnValue('access') };
      const config = { get: () => 20_000 } as unknown as ConfigService;

      authService = new AuthService(
        usersService as unknown as IUsersService,
        jwtService as unknown as JwtService,
        { emit: jest.fn() } as unknown as EventEmitter2,
        {} as GoogleTokenService,
        {} as OtpStoreService,
        {} as never,
        {} as SmsRouterService,
        config,
        passwordSetService as unknown as PasswordSetService,
      );
    });

    it('sets password and returns auth response', async () => {
      passwordSetService.findValidTokenRecord.mockResolvedValue({
        tokenHash: 'hash',
        userId: 'owner-id',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        createdAt: new Date(),
      });
      usersService.findById.mockResolvedValue({
        id: 'owner-id',
        email: 'owner@test.com',
        firstName: 'A',
        lastName: 'B',
        role: UserRole.RESTAURANT_ADMIN,
        authProvider: 'local',
        createdAt: new Date(),
        restaurantId: 'rest-id',
      });
      usersService.updatePassword.mockResolvedValue({
        id: 'owner-id',
        email: 'owner@test.com',
        firstName: 'A',
        lastName: 'B',
        role: UserRole.RESTAURANT_ADMIN,
        authProvider: 'local',
        createdAt: new Date(),
        restaurantId: 'rest-id',
      });

      const response = await authService.setPassword({
        token: 'raw-token',
        password: 'long-enough',
      });

      expect(response.accessToken).toBe('access');
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        'owner-id',
        'long-enough',
      );
      expect(passwordSetService.claimToken).toHaveBeenCalledWith('hash');
    });
  });

  describe('RestaurantsService admin create', () => {
    const restaurantRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    const registrationRepository = { find: jest.fn() };
    const eventEmitter = { emit: jest.fn() };
    const cacheService = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    const locationsService = {
      seedFromRegistration: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      createRestaurantOwner: jest.fn(),
      createRestaurantOwnerInTransaction: jest.fn(),
      bindRestaurant: jest.fn().mockResolvedValue(undefined),
      bindRestaurantInTransaction: jest.fn().mockResolvedValue(undefined),
      findEmailsByUserIds: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const manager = {
            create: jest.fn(
              (_entity: unknown, value: Record<string, unknown>) => value,
            ),
            save: jest.fn((_entity: unknown, value: Record<string, unknown>) =>
              Promise.resolve({
                ...value,
                id: 'rest-id',
                createdAt: new Date(),
              }),
            ),
          };
          return cb(manager);
        },
      ),
    };
    const passwordSetService = {
      issueForUser: jest.fn().mockResolvedValue({
        setPasswordUrl: 'https://app.test/set-password?token=abc',
        expiresAt: new Date().toISOString(),
      }),
    };

    const service = new RestaurantsService(
      restaurantRepository as never,
      registrationRepository as never,
      eventEmitter as never,
      cacheService as never,
      locationsService as never,
      usersService as never,
      passwordSetService as never,
      dataSource as never,
    );

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('creates restaurant with owner invite', async () => {
      usersService.createRestaurantOwnerInTransaction.mockResolvedValue({
        id: 'owner-id',
        email: 'owner@test.com',
        firstName: 'O',
        lastName: '-',
        role: UserRole.RESTAURANT_ADMIN,
        authProvider: 'local',
        createdAt: new Date(),
      });

      const result = await service.createRestaurantWithOwner({
        name: 'Cafe',
        address: 'Street 1',
        owner: {
          email: 'owner@test.com',
          firstName: 'O',
        },
      });

      expect(result.owner.id).toBe('owner-id');
      expect(result.setPasswordUrl).toContain('token=');
      expect(usersService.bindRestaurantInTransaction).toHaveBeenCalled();
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'restaurant.approved',
        expect.anything(),
      );
    });
  });

  describe('MenuService categories', () => {
    const categoryRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      manager: {
        transaction: jest.fn((cb: (manager: unknown) => Promise<void>) =>
          cb({
            update: jest.fn().mockResolvedValue(undefined),
          }),
        ),
      },
    };
    const itemRepository = {
      count: jest.fn(),
    };
    const cacheService = { del: jest.fn().mockResolvedValue(undefined) };
    const nextRevalidationService = {
      revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
    };

    const service = new MenuService(
      categoryRepository as never,
      itemRepository as never,
      cacheService as never,
      nextRevalidationService as never,
    );

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns CATEGORY_NOT_EMPTY when deleting non-empty category', async () => {
      categoryRepository.findOne.mockResolvedValue({
        id: 'cat',
        restaurantId: 'rest',
        name: 'Main',
        sortOrder: 0,
      });
      itemRepository.count.mockResolvedValue(2);

      await expect(service.deleteCategory('rest', 'cat')).rejects.toMatchObject(
        {
          response: { code: 'CATEGORY_NOT_EMPTY' },
        },
      );
    });

    it('reorders categories by ids', async () => {
      categoryRepository.find.mockResolvedValue([
        { id: 'c1', restaurantId: 'rest', sortOrder: 0 },
        { id: 'c2', restaurantId: 'rest', sortOrder: 1 },
      ]);

      await service.reorderCategories('rest', { ids: ['c2', 'c1'] });

      expect(categoryRepository.manager.transaction).toHaveBeenCalled();
    });
  });
});
