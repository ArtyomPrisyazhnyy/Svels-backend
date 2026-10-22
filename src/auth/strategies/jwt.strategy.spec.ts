import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../common/enums/user-role.enum';
import { CacheKeys } from '../../cache/cache-keys';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };
  const usersService = {
    findById: jest.fn(),
  };

  const strategy = new JwtStrategy(
    { getOrThrow: () => 'jwt-secret' } as never,
    cacheService as never,
    usersService as never,
  );

  const payload = {
    sub: '019efb61-5d8e-7058-b838-6f2696cb4200',
    email: 'staff@example.com',
    role: UserRole.RESTAURANT_ADMIN,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached auth user without DB lookup', async () => {
    cacheService.get.mockResolvedValue({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    });

    const user = await strategy.validate(payload);
    expect(user.id).toBe(payload.sub);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('loads user from DB and caches auth fields only', async () => {
    cacheService.get.mockResolvedValue(null);
    usersService.findById.mockResolvedValue({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
    });

    const user = await strategy.validate(payload);

    expect(user).toEqual({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
    });
    expect(cacheService.set).toHaveBeenCalledWith(
      CacheKeys.userAuth(payload.sub),
      user,
      120,
    );
    const cachedPayload = cacheService.set.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(cachedPayload).not.toHaveProperty('passwordHash');
  });

  it('throws when user no longer exists', async () => {
    cacheService.get.mockResolvedValue(null);
    usersService.findById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
