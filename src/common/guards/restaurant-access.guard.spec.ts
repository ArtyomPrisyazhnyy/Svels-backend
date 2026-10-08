import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import { RestaurantAccessGuard } from './restaurant-access.guard';

function createContext(
  user: { id: string; email: string; role: string; restaurantId?: string },
  params: { restaurantId?: string; id?: string },
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params }),
    }),
  } as ExecutionContext;
}

describe('RestaurantAccessGuard', () => {
  const guard = new RestaurantAccessGuard();
  const restaurantId = '0193f0a0-0000-7000-8000-000000000001';

  it('allows a super admin for any restaurant', () => {
    const context = createContext(
      { id: 'sa', email: 'sa@svels.by', role: UserRole.SUPER_ADMIN },
      { restaurantId },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows hall staff bound to the same restaurant', () => {
    const context = createContext(
      {
        id: 'hall',
        email: 'hall@example.com',
        role: UserRole.RESTAURANT_HALL,
        restaurantId,
      },
      { restaurantId },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects staff from another restaurant', () => {
    const context = createContext(
      {
        id: 'hall',
        email: 'hall@example.com',
        role: UserRole.RESTAURANT_HALL,
        restaurantId: '0193f0a0-0000-7000-8000-000000000002',
      },
      { restaurantId },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a guest user', () => {
    const context = createContext(
      {
        id: 'guest',
        email: 'guest@example.com',
        role: UserRole.USER,
        restaurantId,
      },
      { restaurantId },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
