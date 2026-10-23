import { BadRequestException } from '@nestjs/common';
import { OrderSettingsService } from './order-settings.service';
import { RestaurantOrderSettings } from './entities/restaurant-order-settings.entity';

describe('OrderSettingsService', () => {
  const repository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const cacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    del: jest.fn(),
  };

  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };

  const service = new OrderSettingsService(
    repository as never,
    cacheService as never,
    nextRevalidationService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService.get.mockResolvedValue(null);
  });

  it('getByRestaurant reads from DB and bypasses cache', async () => {
    cacheService.get.mockResolvedValue({
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
      ordersPaused: false,
      fulfillmentTakeaway: true,
      fulfillmentDineIn: true,
      fulfillmentDelivery: false,
      paymentCash: true,
      paymentCardOnSite: true,
      paymentOnline: false,
      deliveryForSomeoneElse: false,
      updatedAt: new Date(0),
    });
    repository.findOne.mockResolvedValue({
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
      ordersPaused: true,
      fulfillmentTakeaway: true,
      fulfillmentDineIn: true,
      fulfillmentDelivery: false,
      paymentCash: true,
      paymentCardOnSite: true,
      paymentOnline: false,
      deliveryForSomeoneElse: false,
      updatedAt: new Date(),
    });

    const result = await service.getByRestaurant(
      '019efb61-5d8e-7058-b838-6f2696cb4204',
    );

    expect(result.ordersPaused).toBe(true);
    expect(cacheService.get).not.toHaveBeenCalled();
  });

  it('invalidates order-settings cache after updatePause save', async () => {
    const settings = {
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
      ordersPaused: false,
      fulfillmentTakeaway: true,
      fulfillmentDineIn: true,
      fulfillmentDelivery: false,
      paymentCash: true,
      paymentCardOnSite: true,
      paymentOnline: false,
      deliveryForSomeoneElse: false,
      updatedAt: new Date(),
    } as RestaurantOrderSettings;
    repository.findOne.mockResolvedValue(settings);
    repository.save.mockImplementation((row: RestaurantOrderSettings) => {
      row.ordersPaused = true;
      return Promise.resolve(row);
    });

    await service.updatePause(settings.restaurantId, true);

    expect(repository.save).toHaveBeenCalled();
    expect(cacheService.del).toHaveBeenCalledWith(
      'restaurant:019efb61-5d8e-7058-b838-6f2696cb4204:order-settings',
    );
    const saveOrder = repository.save.mock.invocationCallOrder[0];
    const delOrder = cacheService.del.mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(delOrder);
  });

  it('returns defaults on public read without findOrCreate', async () => {
    repository.findOne.mockResolvedValue(null);

    const result = await service.getPublicByRestaurant(
      '019efb61-5d8e-7058-b838-6f2696cb4204',
    );

    expect(result.fulfillmentTakeaway).toBe(true);
    expect(repository.save).not.toHaveBeenCalled();
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('rejects update when all fulfillment options are disabled', async () => {
    const settings = {
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
      fulfillmentDelivery: false,
      fulfillmentTakeaway: true,
      fulfillmentDineIn: true,
      paymentCash: true,
      paymentCardOnSite: true,
      paymentOnline: true,
    } as RestaurantOrderSettings;

    repository.findOne.mockResolvedValue(settings);

    await expect(
      service.update(settings.restaurantId, {
        fulfillmentTakeaway: false,
        fulfillmentDineIn: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects update when all payment options are disabled', async () => {
    const settings = {
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
      fulfillmentDelivery: false,
      fulfillmentTakeaway: true,
      fulfillmentDineIn: true,
      paymentCash: true,
      paymentCardOnSite: true,
      paymentOnline: true,
    } as RestaurantOrderSettings;

    repository.findOne.mockResolvedValue(settings);

    await expect(
      service.update(settings.restaurantId, {
        paymentCash: false,
        paymentCardOnSite: false,
        paymentOnline: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
