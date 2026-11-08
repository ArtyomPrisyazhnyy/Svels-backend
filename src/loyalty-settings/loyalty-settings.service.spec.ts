jest.mock('../common/utils/uuid.util', () => ({
  generateUuidV7: jest.fn(() => '019efb61-5d8e-7058-b838-6f2696cb4999'),
  isUuidV7: jest.fn(() => true),
}));

import { LoyaltySettingsService } from './loyalty-settings.service';

describe('LoyaltySettingsService cache', () => {
  const settingsRepository = {
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

  const service = new LoyaltySettingsService(
    settingsRepository as never,
    cacheService as never,
    nextRevalidationService as never,
  );

  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService.get.mockResolvedValue(null);
    settingsRepository.findOne.mockResolvedValue({
      restaurantId,
      flameDisplayEnabled: true,
      flameRewardsEnabled: false,
      flameExpireDays: 30,
      flameLevels: [],
      updatedAt: new Date(),
    });
  });

  it('caches loyalty settings on read', async () => {
    await service.getByRestaurant(restaurantId);
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('invalidates cache after update', async () => {
    settingsRepository.save.mockResolvedValue({
      restaurantId,
      flameDisplayEnabled: false,
      flameRewardsEnabled: false,
      flameExpireDays: 30,
      flameLevels: [],
      updatedAt: new Date(),
    });

    await service.update(restaurantId, { flameDisplayEnabled: false });

    expect(cacheService.del).toHaveBeenCalledWith(
      `restaurant:${restaurantId}:loyalty-settings`,
    );
  });
});
