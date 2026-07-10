import { BadRequestException } from '@nestjs/common';
import { OrderSettingsService } from './order-settings.service';
import { RestaurantOrderSettings } from './entities/restaurant-order-settings.entity';

describe('OrderSettingsService', () => {
  const repository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const nextRevalidationService = {
    revalidateRestaurantPublicPage: jest.fn().mockResolvedValue(undefined),
  };

  const service = new OrderSettingsService(repository as never, nextRevalidationService as never);

  beforeEach(() => {
    jest.clearAllMocks();
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
