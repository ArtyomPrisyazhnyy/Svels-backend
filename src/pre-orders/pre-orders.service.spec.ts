jest.mock('../payments/payments.service', () => ({
  PaymentsService: class PaymentsService {},
}));

jest.mock('./pricing/minsk-time.util', () => {
  const actual = jest.requireActual<typeof import('./pricing/minsk-time.util')>(
    './pricing/minsk-time.util',
  );
  return {
    ...actual,
    isRestaurantOpenAt: jest.fn(() => true),
  };
});

import { EventEmitter2 } from '@nestjs/event-emitter';
import { FulfillmentType } from '../common/enums/fulfillment-type.enum';
import { LoyaltyRewardType } from '../common/enums/loyalty.enum';
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
  const paymentsService = {
    startOnlineCheckout: jest.fn(),
  };
  const loyaltyOrderPricing = {
    loadForCart: jest.fn(),
  };
  const emitMock = jest.fn();
  const eventEmitter = { emit: emitMock } as unknown as EventEmitter2;
  const schedulesService = {
    getByRestaurant: jest.fn().mockResolvedValue([]),
  };
  const usersService = {
    findById: jest.fn().mockResolvedValue({ phone: '375291234567' }),
  };

  const guestAddressLookup = {
    findSnapshotForOrder: jest.fn<
      Promise<{ street: string; house: string } | null>,
      [string, string, string]
    >(),
    touchLastUsedAt: jest.fn<Promise<void>, [string, string, string, Date]>(),
    touchOrSave: jest.fn<
      Promise<void>,
      [
        {
          userId: string;
          restaurantId: string;
          snapshot: { street: string; house: string };
          label?: string;
          now: Date;
        },
      ]
    >(),
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
    guestAddressLookup,
    usersService as never,
    loyaltyOrderPricing,
  );

  const restaurantId = '019efb61-5d8e-7058-b838-6f2696cb4204';

  const openSettings = {
    ordersPaused: false,
    fulfillmentDelivery: true,
    fulfillmentTakeaway: true,
    fulfillmentDineIn: true,
    paymentCash: true,
    paymentCardOnSite: true,
    paymentOnline: true,
    deliveryForSomeoneElse: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(minsTime.isRestaurantOpenAt).mockReturnValue(true);
    menuService.getMenuByRestaurant.mockResolvedValue({ categories: [] });
    loyaltyOrderPricing.loadForCart.mockResolvedValue({
      settings: {
        restaurantId,
        flameDisplayEnabled: false,
        flameRewardsEnabled: false,
        flameExpireDays: 14,
        flameLevels: [],
      },
      balance: null,
    });
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
    jest.mocked(minsTime.isRestaurantOpenAt).mockReturnValue(false);

    await expect(
      service.create(restaurantId, 'user', baseDto),
    ).rejects.toMatchObject({
      response: { code: 'RESTAURANT_CLOSED' },
    });
  });

  it('uses addressId snapshot and touches lastUsedAt', async () => {
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
              modifierGroups: [],
            },
          ],
        },
      ],
    });
    guestAddressLookup.findSnapshotForOrder.mockResolvedValue({
      street: 'Сохранённая',
      house: '5',
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
              orderNumber: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          ),
        }),
    );
    preOrderItemRepository.find.mockResolvedValue([]);

    await service.create(restaurantId, 'user', {
      ...baseDto,
      addressId: '019efb61-5d8e-7058-b838-6f2696cb4100',
      deliveryAddress: { street: 'Игнор', house: '1' },
    });

    expect(guestAddressLookup.findSnapshotForOrder).toHaveBeenCalled();
    expect(guestAddressLookup.touchLastUsedAt).toHaveBeenCalled();
    expect(guestAddressLookup.touchOrSave).not.toHaveBeenCalled();
  });

  it('rejects foreign addressId with ADDRESS_NOT_FOUND', async () => {
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
    guestAddressLookup.findSnapshotForOrder.mockResolvedValue(null);

    await expect(
      service.create(restaurantId, 'user', {
        ...baseDto,
        addressId: '019efb61-5d8e-7058-b838-6f2696cb4100',
        deliveryAddress: undefined,
      }),
    ).rejects.toMatchObject({
      response: { code: 'ADDRESS_NOT_FOUND' },
    });
  });

  it('saveAddress calls touchOrSave after order without failing on limit', async () => {
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
              modifierGroups: [],
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
              orderNumber: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          ),
        }),
    );
    preOrderItemRepository.find.mockResolvedValue([]);
    guestAddressLookup.touchOrSave.mockResolvedValue(undefined);

    await service.create(restaurantId, 'user', {
      ...baseDto,
      saveAddress: true,
      addressLabel: 'Дом',
    });

    expect(guestAddressLookup.touchOrSave).toHaveBeenCalled();
    const saveCall = guestAddressLookup.touchOrSave.mock.calls[0][0];
    expect(saveCall.userId).toBe('user');
    expect(saveCall.restaurantId).toBe(restaurantId);
    expect(saveCall.label).toBe('Дом');
    expect(saveCall.snapshot).toMatchObject({ street: 'Ленина', house: '1' });
  });

  it('ignores address fields for non-delivery', async () => {
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
              modifierGroups: [],
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
              orderNumber: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          ),
        }),
    );
    preOrderItemRepository.find.mockResolvedValue([]);

    await service.create(restaurantId, 'user', {
      ...baseDto,
      fulfillmentType: FulfillmentType.TAKEAWAY,
      deliveryAddress: undefined,
      addressId: '019efb61-5d8e-7058-b838-6f2696cb4100',
      saveAddress: true,
    });

    expect(guestAddressLookup.findSnapshotForOrder).not.toHaveBeenCalled();
    expect(guestAddressLookup.touchLastUsedAt).not.toHaveBeenCalled();
    expect(guestAddressLookup.touchOrSave).not.toHaveBeenCalled();
  });

  it('does not fail order when touchOrSave throws', async () => {
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
              modifierGroups: [],
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
              orderNumber: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          ),
        }),
    );
    preOrderItemRepository.find.mockResolvedValue([]);
    guestAddressLookup.touchOrSave.mockRejectedValue(new Error('db'));

    await expect(
      service.create(restaurantId, 'user', {
        ...baseDto,
        saveAddress: true,
      }),
    ).resolves.toBeDefined();
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

  it('ignores client unitPrice, discount and total and stores the server total', async () => {
    orderSettingsService.getByRestaurant.mockResolvedValue(openSettings);
    menuService.getMenuByRestaurant.mockResolvedValue({
      categories: [
        {
          items: [
            {
              id: '019efb61-5d8e-7058-b838-6f2696cb4201',
              name: 'Бургер',
              price: 10,
              isAvailable: true,
              modifierGroups: [],
            },
          ],
        },
      ],
    });
    loyaltyOrderPricing.loadForCart.mockResolvedValue({
      settings: {
        restaurantId,
        flameDisplayEnabled: true,
        flameRewardsEnabled: true,
        flameExpireDays: 14,
        flameLevels: [
          {
            id: '019efb61-5d8e-7058-b838-6f2696cb4210',
            name: 'Искра',
            requiredVisits: 1,
            rewards: [
              {
                id: '019efb61-5d8e-7058-b838-6f2696cb4211',
                type: LoyaltyRewardType.PERCENT_DISCOUNT,
                title: '10%',
                description: null,
                percentOff: 10,
                amountOff: null,
                menuItemId: null,
                minOrderAmount: null,
              },
            ],
          },
        ],
      },
      balance: {
        restaurantId,
        userId: 'user',
        visits: 2,
        totalVisits: 2,
        lastVisitAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const created: Array<Record<string, unknown>> = [];
    dataSource.transaction.mockImplementation(
      <T>(fn: (manager: unknown) => Promise<T>) =>
        fn({
          query: jest.fn().mockResolvedValue([{ next: 4 }]),
          create: jest.fn((_entity: unknown, data: Record<string, unknown>) => {
            created.push(data);
            return data;
          }),
          save: jest.fn((entity: Record<string, unknown>) =>
            Promise.resolve({
              ...entity,
              id: '019efb61-5d8e-7058-b838-6f2696cb4999',
              orderNumber: 4,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          ),
        }),
    );
    preOrderItemRepository.find.mockResolvedValue([]);
    paymentsService.startOnlineCheckout.mockResolvedValue({
      redirectUrl: 'https://pay.example/checkout',
    });

    const result = await service.create(restaurantId, 'user', {
      ...baseDto,
      paymentMethod: PaymentMethod.ONLINE,
      items: [
        {
          menuItemId: '019efb61-5d8e-7058-b838-6f2696cb4201',
          quantity: 2,
          unitPrice: 1,
          name: 'Халява',
        },
      ],
      discount: 100,
      totalAmount: 0.01,
      loyaltyDiscountAmount: 100,
    } as CreatePreOrderDto);

    expect(created[0]).toMatchObject({
      subtotalAmount: 20,
      loyaltyDiscountAmount: 2,
      totalAmount: 18,
      loyaltyLevelName: 'Искра',
    });
    expect(created[1]).toMatchObject({
      name: 'Бургер',
      unitPrice: 10,
      quantity: 2,
    });
    expect(result.totalAmount).toBe(18);
    expect(result.subtotalAmount).toBe(20);
    expect(result.loyaltyDiscountAmount).toBe(2);
    expect(paymentsService.startOnlineCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 18 }),
    );
  });

  it('quotes a guest cart from the menu without a loyalty lookup', async () => {
    menuService.getMenuByRestaurant.mockResolvedValue({
      categories: [
        {
          items: [
            {
              id: '019efb61-5d8e-7058-b838-6f2696cb4201',
              name: 'Бургер',
              price: 10,
              isAvailable: true,
              modifierGroups: [],
            },
          ],
        },
      ],
    });

    const quote = await service.quote(restaurantId, null, {
      items: [
        {
          menuItemId: '019efb61-5d8e-7058-b838-6f2696cb4201',
          quantity: 2,
        },
      ],
    });

    expect(loyaltyOrderPricing.loadForCart).not.toHaveBeenCalled();
    expect(quote.subtotal).toBe(20);
    expect(quote.total).toBe(20);
    expect(quote.loyaltyDiscount).toBeNull();
    expect(quote.giftRewards).toEqual([]);
    expect(quote).not.toHaveProperty('loyaltyRewardSnapshot');
  });
});
