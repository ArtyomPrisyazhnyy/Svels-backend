import { RestaurantStylingService } from './restaurant-styling.service';

describe('RestaurantStylingService cache', () => {
  const stylingRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };

  const service = new RestaurantStylingService(
    stylingRepository as never,
    cacheService as never,
    nextRevalidationService as never,
  );

  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns defaults on public read without writing', async () => {
    cacheService.get.mockResolvedValue(null);
    stylingRepository.findOne.mockResolvedValue(null);

    const result = await service.getPublicByRestaurant(restaurantId);

    expect(result.restaurantId).toBe(restaurantId);
    expect(stylingRepository.save).not.toHaveBeenCalled();
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('invalidates cache after update', async () => {
    stylingRepository.findOne.mockResolvedValue({ restaurantId });
    stylingRepository.save.mockResolvedValue({
      restaurantId,
      updatedAt: new Date(),
    });

    await service.update(restaurantId, { favoritesEnabled: false });

    expect(cacheService.del).toHaveBeenCalledWith(
      `restaurant:${restaurantId}:styling`,
    );
  });
});
