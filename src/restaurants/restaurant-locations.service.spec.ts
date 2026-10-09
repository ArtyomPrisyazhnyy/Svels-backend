import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RestaurantLocationsService } from './restaurant-locations.service';
describe('RestaurantLocationsService', () => {
  const locationRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    create: jest.fn(<T>(value: T) => value),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const restaurantRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };

  const service = new RestaurantLocationsService(
    locationRepository as never,
    restaurantRepository as never,
    cacheService as never,
    nextRevalidationService as never,
  );

  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';
  const locationId = '019efb61-5d8e-7058-b838-6f2696cb4205';

  beforeEach(() => {
    jest.clearAllMocks();
    restaurantRepository.findOne.mockResolvedValue({
      id: restaurantId,
      address: 'Минск, пр. Независимости 1',
    });
    cacheService.get.mockResolvedValue(null);
  });

  it('does not allow deleting the last location', async () => {
    locationRepository.findOne.mockResolvedValue({
      id: locationId,
      restaurantId,
    });
    locationRepository.count.mockResolvedValue(1);

    await expect(
      service.remove(restaurantId, locationId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(locationRepository.remove).not.toHaveBeenCalled();
  });

  it('deletes a location when more than one remains', async () => {
    locationRepository.findOne
      .mockResolvedValueOnce({
        id: locationId,
        restaurantId,
      })
      .mockResolvedValueOnce({
        id: '019efb61-5d8e-7058-b838-6f2696cb4206',
        restaurantId,
        city: 'Минск',
        address: 'ул. Ленина 2',
      });
    locationRepository.count.mockResolvedValue(2);
    locationRepository.remove.mockResolvedValue(undefined);
    restaurantRepository.update.mockResolvedValue(undefined);

    await service.remove(restaurantId, locationId);

    expect(locationRepository.remove).toHaveBeenCalled();
    expect(restaurantRepository.update).toHaveBeenCalled();
  });

  it('rejects create for unknown restaurant', async () => {
    restaurantRepository.findOne.mockResolvedValue(null);

    await expect(
      service.create(restaurantId, {
        city: 'Минск',
        address: 'ул. Ленина 1',
        lat: 53.9,
        lng: 27.56,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
