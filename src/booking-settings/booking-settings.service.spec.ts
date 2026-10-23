import { BookingSettingsService } from './booking-settings.service';
import type { RestaurantBookingSettings } from './entities/restaurant-booking-settings.entity';

describe('BookingSettingsService cache', () => {
  const settingsRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    delMany: jest.fn(),
  };
  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };

  const service = new BookingSettingsService(
    settingsRepository as never,
    cacheService as never,
    nextRevalidationService as never,
  );

  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';

  beforeEach(() => {
    jest.clearAllMocks();
    settingsRepository.findOne.mockResolvedValue({
      restaurantId,
      bookingEnabled: true,
      updatedAt: new Date(),
    });
    settingsRepository.save.mockImplementation(
      (row: RestaurantBookingSettings) => row,
    );
  });

  it('invalidates booking and floor-plan caches after update', async () => {
    await service.update(restaurantId, { bookingEnabled: false });

    expect(cacheService.delMany).toHaveBeenCalledWith([
      `restaurant:${restaurantId}:booking-settings`,
      `restaurant:${restaurantId}:floor-plan`,
      `restaurant:${restaurantId}:public-layout`,
    ]);
  });
});
