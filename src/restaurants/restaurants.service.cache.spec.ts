import { NotFoundException } from '@nestjs/common';
import { RestaurantStatus } from '../common/enums/restaurant-status.enum';
import { CacheKeys } from '../cache/cache-keys';
import { RestaurantsService } from './restaurants.service';

describe('RestaurantsService cache behaviour', () => {
  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';

  const restaurantRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };
  const registrationRepository = { findOne: jest.fn(), save: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delMany: jest.fn(),
    getWithSentinel: jest.fn(),
    setNullSentinel: jest.fn(),
  };
  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };
  const locationsService = {
    seedFromRegistration: jest.fn(),
  };
  const usersService = {
    findEmailsByUserIds: jest.fn(),
    createRestaurantOwnerInTransaction: jest.fn(),
    bindRestaurantInTransaction: jest.fn(),
  };
  const passwordSetService = { issueForUser: jest.fn() };
  const dataSource = { transaction: jest.fn() };

  const service = new RestaurantsService(
    restaurantRepository as never,
    registrationRepository as never,
    eventEmitter as never,
    cacheService as never,
    nextRevalidationService as never,
    locationsService as never,
    usersService as never,
    passwordSetService as never,
    dataSource as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('caches negative domain lookup for 60s', async () => {
    cacheService.getWithSentinel.mockResolvedValue({ status: 'miss' });
    restaurantRepository.findOne.mockResolvedValue(null);

    await expect(service.resolveByDomain('cafe.example.com')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(cacheService.setNullSentinel).toHaveBeenCalledWith(
      CacheKeys.restaurantByDomain('cafe.example.com'),
      60,
    );
  });

  it('findById uses restaurant public cache', async () => {
    cacheService.get.mockResolvedValue({
      id: restaurantId,
      name: 'Cafe',
      status: RestaurantStatus.APPROVED,
    });

    const result = await service.findById(restaurantId);
    expect(result.name).toBe('Cafe');
    expect(restaurantRepository.findOne).not.toHaveBeenCalled();
  });

  it('invalidates cache after save on update', async () => {
    const entity = {
      id: restaurantId,
      name: 'Old',
      customDomain: 'old.example.com',
      status: RestaurantStatus.APPROVED,
      createdAt: new Date(),
    };
    restaurantRepository.findOne.mockResolvedValue(entity);
    restaurantRepository.save.mockImplementation(async (row) => row);

    await service.update(restaurantId, { name: 'New Name' });

    expect(restaurantRepository.save).toHaveBeenCalled();
    expect(cacheService.delMany).toHaveBeenCalledWith([
      CacheKeys.restaurantPublic(restaurantId),
      CacheKeys.restaurantByDomain('old.example.com'),
    ]);
    expect(nextRevalidationService.revalidateRestaurantPublicPage).toHaveBeenCalledWith(
      restaurantId,
    );
  });

  it('remove deletes all scoped restaurant keys', async () => {
    restaurantRepository.findOne.mockResolvedValue({
      id: restaurantId,
      customDomain: 'cafe.example.com',
    });
    restaurantRepository.delete.mockResolvedValue(undefined);

    await service.remove(restaurantId);

    const delArg = cacheService.delMany.mock.calls[0][0] as string[];
    expect(delArg).toContain(CacheKeys.menu(restaurantId));
    expect(delArg).toContain(CacheKeys.restaurantByDomain('cafe.example.com'));
  });
});
