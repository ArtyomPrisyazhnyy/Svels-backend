import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import { LoyaltySettingsService } from '../loyalty-settings/loyalty-settings.service';
import { OrderStatusChangedEvent } from '../pre-orders/events/order-status-changed.event';
import { LoyaltyOrderEventsListener } from './loyalty-order-events.listener';
import { LoyaltyService } from './loyalty.service';

jest.mock('../common/utils/uuid.util', () => ({
  generateUuidV7: () => '0190c0de-0000-7000-8000-0000000000dd',
}));

const RESTAURANT_ID = '0190c0de-0000-7000-8000-0000000000ff';
const USER_ID = '0190c0de-0000-7000-8000-0000000000aa';
const ORDER_ID = '0190c0de-0000-7000-8000-0000000000bb';

function makeEvent(
  overrides: Partial<
    ConstructorParameters<typeof OrderStatusChangedEvent>[0]
  > = {},
): OrderStatusChangedEvent {
  return new OrderStatusChangedEvent({
    orderId: ORDER_ID,
    restaurantId: RESTAURANT_ID,
    orderNumber: 1,
    from: PreOrderStatus.READY,
    to: PreOrderStatus.COMPLETED,
    actor: { type: 'staff', userId: USER_ID },
    userId: USER_ID,
    ...overrides,
  });
}

describe('LoyaltyOrderEventsListener', () => {
  let settingsService: { getByRestaurant: jest.Mock };
  let loyaltyService: { recordVisit: jest.Mock };
  let listener: LoyaltyOrderEventsListener;

  beforeEach(() => {
    settingsService = {
      getByRestaurant: jest.fn().mockResolvedValue({
        restaurantId: RESTAURANT_ID,
        flameDisplayEnabled: true,
        flameRewardsEnabled: false,
        flameExpireDays: 21,
        flameLevels: [],
      }),
    };
    loyaltyService = { recordVisit: jest.fn().mockResolvedValue(true) };

    listener = new LoyaltyOrderEventsListener(
      settingsService as unknown as LoyaltySettingsService,
      loyaltyService as unknown as LoyaltyService,
    );
  });

  it('records a visit when a guest order is completed', async () => {
    await listener.onOrderStatusChanged(makeEvent());

    expect(loyaltyService.recordVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        userId: USER_ID,
        orderId: ORDER_ID,
        expireDays: 21,
      }),
    );
  });

  it('does nothing when the order is not completed', async () => {
    await listener.onOrderStatusChanged(
      makeEvent({ to: PreOrderStatus.READY, from: PreOrderStatus.PREPARING }),
    );

    expect(settingsService.getByRestaurant).not.toHaveBeenCalled();
    expect(loyaltyService.recordVisit).not.toHaveBeenCalled();
  });

  it('does nothing when the order has no user', async () => {
    await listener.onOrderStatusChanged(makeEvent({ userId: undefined }));

    expect(loyaltyService.recordVisit).not.toHaveBeenCalled();
  });

  it('does not record a visit when the loyalty program display is disabled', async () => {
    settingsService.getByRestaurant.mockResolvedValue({
      restaurantId: RESTAURANT_ID,
      flameDisplayEnabled: false,
      flameRewardsEnabled: false,
      flameExpireDays: 14,
      flameLevels: [],
    });

    await listener.onOrderStatusChanged(makeEvent());

    expect(loyaltyService.recordVisit).not.toHaveBeenCalled();
  });

  it('swallows errors from recordVisit so the status change is not affected', async () => {
    loyaltyService.recordVisit.mockRejectedValue(new Error('db down'));

    await expect(
      listener.onOrderStatusChanged(makeEvent()),
    ).resolves.toBeUndefined();
  });
});
