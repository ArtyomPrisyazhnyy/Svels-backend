import { UserRole } from '../common/enums/user-role.enum';
import { UsersService } from './users.service';

describe('UsersService platform auth lookup', () => {
  const restaurantAdminWithBoundRestaurant = {
    id: 'admin-id',
    email: 'owner@example.com',
    passwordHash: 'hash',
    role: UserRole.RESTAURANT_ADMIN,
    authProvider: 'local',
    googleId: null,
    restaurantId: 'restaurant-id',
  };

  const repository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const eventEmitter = { emit: jest.fn() };
  const service = new UsersService(repository as never, eventEmitter as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('finds restaurant admin after restaurantId is assigned on approval', async () => {
    repository.findOne.mockResolvedValue(restaurantAdminWithBoundRestaurant);

    const user = await service.findPlatformUserByEmail('owner@example.com');

    expect(user).toEqual(restaurantAdminWithBoundRestaurant);
    expect(repository.findOne).toHaveBeenCalledTimes(1);
    const findOneCalls = repository.findOne.mock.calls as Array<
      [{ where: Array<Record<string, unknown>> }]
    >;
    const findArgs = findOneCalls[0][0];
    expect(findArgs.where).toHaveLength(2);
    expect(findArgs.where[0]).toMatchObject({
      email: 'owner@example.com',
    });
    expect(findArgs.where[0]).toHaveProperty('restaurantId');
    expect(findArgs.where[1]).toMatchObject({
      email: 'owner@example.com',
    });
    expect(findArgs.where[1]).toHaveProperty('role');
  });

  it('includes restaurantId for hall staff in profile responses', async () => {
    repository.findOne.mockResolvedValue({
      id: 'hall-id',
      email: 'hall@example.com',
      firstName: 'Hall',
      lastName: 'Staff',
      role: UserRole.RESTAURANT_HALL,
      authProvider: 'local',
      restaurantId: 'restaurant-id',
      createdAt: new Date(),
    });

    const profile = await service.findById('hall-id');

    expect(profile?.restaurantId).toBe('restaurant-id');
    expect(profile?.role).toBe(UserRole.RESTAURANT_HALL);
  });
});
