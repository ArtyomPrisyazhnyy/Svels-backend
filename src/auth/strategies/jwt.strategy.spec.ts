import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '../../common/enums/user-role.enum';
import type { IUsersService } from '../../users/interfaces/users-service.interface';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const usersService: jest.Mocked<Pick<IUsersService, 'findForJwtValidation'>> =
    {
      findForJwtValidation: jest.fn(),
    };

  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(
      {
        getOrThrow: () => 'test-secret',
      } as ConfigService,
      usersService as unknown as IUsersService,
    );
  });

  it('rejects tokens issued before passwordChangedAt', async () => {
    const passwordChangedAt = new Date('2026-11-04T12:00:00.000Z');
    usersService.findForJwtValidation.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      role: UserRole.USER,
      restaurantId: null,
      passwordChangedAt,
    });

    await expect(
      strategy.validate({
        sub: 'user-id',
        email: 'user@example.com',
        role: UserRole.USER,
        iat: Math.floor(passwordChangedAt.getTime() / 1000) - 10,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts tokens issued at or after passwordChangedAt', async () => {
    const passwordChangedAt = new Date('2026-11-04T12:00:00.000Z');
    const changedAtSec = Math.floor(passwordChangedAt.getTime() / 1000);
    usersService.findForJwtValidation.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      role: UserRole.USER,
      restaurantId: null,
      passwordChangedAt,
    });

    await expect(
      strategy.validate({
        sub: 'user-id',
        email: 'user@example.com',
        role: UserRole.USER,
        iat: changedAtSec,
      }),
    ).resolves.toEqual({
      id: 'user-id',
      email: 'user@example.com',
      role: UserRole.USER,
      restaurantId: undefined,
    });
  });

  it('accepts tokens when passwordChangedAt is null', async () => {
    usersService.findForJwtValidation.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      role: UserRole.RESTAURANT_ADMIN,
      restaurantId: 'restaurant-id',
      passwordChangedAt: null,
    });

    await expect(
      strategy.validate({
        sub: 'user-id',
        email: 'user@example.com',
        role: UserRole.RESTAURANT_ADMIN,
        restaurantId: 'restaurant-id',
        iat: 1,
      }),
    ).resolves.toMatchObject({ id: 'user-id' });
  });
});
