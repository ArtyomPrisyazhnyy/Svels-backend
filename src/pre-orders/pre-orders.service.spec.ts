jest.mock('../payments/payments.service', () => ({
  PaymentsService: class PaymentsService {},
}));

import { EventEmitter2 } from '@nestjs/event-emitter';
import { FulfillmentType } from '../common/enums/fulfillment-type.enum';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { CreatePreOrderDto } from './dto/create-pre-order.dto';
import * as minsTime from './pricing/minsk-time.util';
import { PreOrdersService } from './pre-orders.service';

describe('PreOrdersService.create validations', () => {
  const preOrderRepository = {};
  const preOrderItemRepository = { find: jest.fn() };
  const locationRepository = {
    find: jest.fn().mockResolvedValue([]),
  };
  const menuService = {
    getMenuByRestaurant: jest.fn(),
  };
  const orderSettingsService = {
    getByRestaurant: jest.fn(),
  };
  const dataSource = { transaction: jest.fn() };
  const paymentsService = {};
  const emitMock = jest.fn();
  const eventEmitter = { emit: emitMock } as unknown as EventEmitter2;
  const schedulesService = {
    getByRestaurant: jest.fn().mockResolvedValue([]),
  };

  const service = new PreOrdersService(
    preOrderRepository as never,
    preOrderItemRepository as never,
    locationRepository as never,
    menuService as never,
    orderSettingsService as never,
    dataSource as never,
    paymentsService as never,
    eventEmitter,
    schedulesService as never,
  );

  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';

  beforeEach(() => {
    jest.clearAllMocks();
    menuService.getMenuByRestaurant.mockResolvedValue({ categories: [] });
  });

  const baseDto: CreatePreOrderDto = {
    fulfillmentType: FulfillmentType.DELIVERY,
    paymentMethod: PaymentMethod.CASH,
    items: [
      {
        menuItemId: '019efb61-5d8e-7058-b838-6f2696cb4201',
        quantity: 1,
      },
    ],
    customerName: 'Иван',
    customerPhone: '+375291234567',
    deliveryAddress: { street: 'Ленина', house: '1' },
  };

  it('rejects when orders are paused', async () => {
    orderSettingsService.getByRestaurant.mockResolvedValue({
      ordersPaused: true,
      fulfillmentDelivery: true,
      fulfillmentTakeaway: true,
      fulfillmentDineIn: true,
      paymentCash: true,
      paymentCardOnSite: true,
      paymentOnline: true,
      deliveryForSomeoneElse: false,
    });

    await expect(
      service.create(restaurantId, 'user', baseDto),
    ).rejects.toMatchObject({
      response: { code: 'ORDERS_PAUSED' },
    });
  });

  it('rejects delivery without address', async () => {
    orderSettingsService.getByRestaurant.mockResolvedValue({
      ordersPaused: false,
      fulfillmentDelivery: true,
      fulfillmentTakeaway: true,
      fulfillmentDineIn: true,
      paymentCash: true,
      paymentCardOnSite: true,
      paymentOnline: true,
      deliveryForSomeoneElse: false,
    });

    await expect(
      service.create(restaurantId, 'user', {
        ...baseDto,
        deliveryAddress: undefined,
      }),
    ).rejects.toMatchObject({
      response: { code: 'ADDRESS_REQUIRED' },
    });
  });

  it('computes total from menu price and modifiers', async () => {
    orderSettingsService.getByRestaurant.mockResolvedValue({
      ordersPaused: false,
      fulfillmentDelivery: true,
      fulfillmentTakeaway: true,
      fulfillmentDineIn: true,
      paymentCash: true,
      paymentCardOnSite: true,
      paymentOnline: true,
      deliveryForSomeoneElse: false,
    });

    menuService.getMenuByRestaurant.mockResolvedValue({
      categories: [
        {
          items: [
            {
              id: '019efb61-5d8e-7058-b838-6f2696cb4201',
              name: 'Бургер',
              price: 10,
              isAvailable: true,
              modifierGroups: [
                {
                  id: 'grp-1',
                  name: 'Соус',
                  selectionType: 'single',
                  required: true,
                  options: [{ id: 'opt-1', name: 'Сырный', priceDelta: 2 }],
                },
              ],
            },
          ],
        },
      ],
    });

    dataSource.transaction.mockImplementation(
      <T>(fn: (manager: unknown) => Promise<T>) =>
        fn({
          query: jest.fn().mockResolvedValue([{ next: 1 }]),
          create: jest.fn(
            (_entity: unknown, data: Record<string, unknown>) => data,
          ),
          save: jest.fn((entity: Record<string, unknown>) =>
            Promise.resolve({
              ...entity,
              id: '019efb61-5d8e-7058-b838-6f2696cb4999',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          ),
        }),
    );

    preOrderItemRepository.find.mockResolvedValue([
      {
        id: '019efb61-5d8e-7058-b838-6f2696cb4998',
        menuItemId: '019efb61-5d8e-7058-b838-6f2696cb4201',
        name: 'Бургер',
        quantity: 2,
        unitPrice: 12,
        modifiers: [{ groupName: 'Соус', optionName: 'Сырный', priceDelta: 2 }],
      },
    ]);

    const result = await service.create(restaurantId, 'user', {
      ...baseDto,
      items: [
        {
          menuItemId: '019efb61-5d8e-7058-b838-6f2696cb4201',
          quantity: 2,
          modifierSelections: { 'grp-1': ['opt-1'] },
        },
      ],
    });

    expect(result.totalAmount).toBe(24);
    expect(result.items[0].unitPrice).toBe(12);
    expect(emitMock.mock.calls).not.toHaveLength(0);
  });

  it('rejects when restaurant is closed by schedule', async () => {
    orderSettingsService.getByRestaurant.mockResolvedValue({
      ordersPaused: false,
      fulfillmentDelivery: true,
      fulfillmentTakeaway: true,
      fulfillmentDineIn: true,
      paymentCash: true,
      paymentCardOnSite: true,
      paymentOnline: true,
      deliveryForSomeoneElse: false,
    });
    jest.spyOn(minsTime, 'isRestaurantOpenAt').mockReturnValue(false);

    await expect(
      service.create(restaurantId, 'user', baseDto),
    ).rejects.toMatchObject({
      response: { code: 'RESTAURANT_CLOSED' },
    });
  });

  it('rejects disabled payment method', async () => {
    orderSettingsService.getByRestaurant.mockResolvedValue({
      ordersPaused: false,
      fulfillmentDelivery: true,
      fulfillmentTakeaway: true,
      fulfillmentDineIn: true,
      paymentCash: false,
      paymentCardOnSite: true,
      paymentOnline: true,
      deliveryForSomeoneElse: false,
    });

    await expect(
      service.create(restaurantId, 'user', baseDto),
    ).rejects.toMatchObject({
      response: { code: 'PAYMENT_METHOD_DISABLED' },
    });
  });
});
