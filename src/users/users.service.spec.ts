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
    expect(repository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          expect.objectContaining({
            email: 'owner@example.com',
            restaurantId: expect.anything(),
          }),
          expect.objectContaining({
            email: 'owner@example.com',
            role: expect.anything(),
          }),
        ]),
      }),
    );
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
