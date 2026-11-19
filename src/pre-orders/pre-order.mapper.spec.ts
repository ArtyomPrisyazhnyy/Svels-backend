import { FulfillmentType } from '../common/enums/fulfillment-type.enum';
import { OrderPaymentStatus } from '../common/enums/order-payment-status.enum';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import { PreOrderItem } from './entities/pre-order-item.entity';
import { PreOrder } from './entities/pre-order.entity';
import { mapPreOrderToOrderDto } from './pre-order.mapper';

describe('mapPreOrderToOrderDto', () => {
  it('maps order fields and line totals', () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z');
    const updatedAt = new Date('2026-01-01T11:00:00.000Z');
    const statusChangedAt = new Date('2026-01-01T10:05:00.000Z');

    const order = {
      id: '019efb61-5d8e-7058-b838-6f2696cb4200',
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
      orderNumber: 3,
      userId: '019efb61-5d8e-7058-b838-6f2696cb4202',
      bookingId: null,
      status: PreOrderStatus.NEW,
      paymentStatus: OrderPaymentStatus.NOT_REQUIRED,
      paymentMethod: PaymentMethod.CASH,
      fulfillmentType: FulfillmentType.TAKEAWAY,
      customerName: 'Иван',
      customerPhone: '375291234567',
      recipientName: null,
      recipientPhone: null,
      deliveryAddress: null,
      locationId: null,
      requestedAt: null,
      cancelReason: null,
      totalAmount: 25.5,
      comment: null,
      createdAt,
      updatedAt,
      statusChangedAt,
    } as PreOrder;

    const items = [
      {
        id: '019efb61-5d8e-7058-b838-6f2696cb4203',
        preOrderId: order.id,
        menuItemId: '019efb61-5d8e-7058-b838-6f2696cb4201',
        name: 'Бургер',
        quantity: 2,
        unitPrice: 12.75,
        modifiers: [{ groupName: 'Соус', optionName: 'Сырный', priceDelta: 2 }],
        createdAt,
      } as PreOrderItem,
    ];

    const dto = mapPreOrderToOrderDto(order, items);

    expect(dto.orderNumber).toBe(3);
    expect(dto.items[0].lineTotal).toBe(25.5);
    expect(dto.statusChangedAt).toBe(statusChangedAt.toISOString());
    expect(dto.paymentStatus).toBe(OrderPaymentStatus.NOT_REQUIRED);
    expect(dto.subtotalAmount).toBe(25.5);
    expect(dto.loyaltyDiscountAmount).toBe(0);
    expect(dto.loyaltyDiscount).toBeNull();
    expect(dto.giftRewards).toEqual([]);
  });

  it('exposes the loyalty snapshot, including gift names for staff', () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z');
    const order = {
      id: '019efb61-5d8e-7058-b838-6f2696cb4200',
      restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
      orderNumber: 4,
      status: PreOrderStatus.NEW,
      paymentStatus: OrderPaymentStatus.NOT_REQUIRED,
      paymentMethod: PaymentMethod.CASH,
      fulfillmentType: FulfillmentType.TAKEAWAY,
      customerName: 'Иван',
      customerPhone: '375291234567',
      recipientName: null,
      recipientPhone: null,
      deliveryAddress: null,
      locationId: null,
      requestedAt: null,
      comment: null,
      cancelReason: null,
      subtotalAmount: '40.00',
      loyaltyDiscountAmount: '4.00',
      loyaltyLevelId: '019efb61-5d8e-7058-b838-6f2696cb4210',
      loyaltyLevelName: 'Искра',
      totalAmount: '36.00',
      loyaltyRewardSnapshot: {
        discount: {
          levelId: '019efb61-5d8e-7058-b838-6f2696cb4210',
          levelName: 'Искра',
          rewardType: 'percent_discount',
          percentOff: 10,
          amountOff: null,
          amount: 4,
        },
        gifts: [{ name: 'Кофе в подарок' }],
      },
      bookingId: null,
      createdAt,
      updatedAt: createdAt,
      statusChangedAt: createdAt,
    } as PreOrder;

    const dto = mapPreOrderToOrderDto(order, []);

    expect(dto.subtotalAmount).toBe(40);
    expect(dto.loyaltyDiscountAmount).toBe(4);
    expect(dto.totalAmount).toBe(36);
    expect(dto.loyaltyLevelName).toBe('Искра');
    expect(dto.loyaltyDiscount?.amount).toBe(4);
    expect(dto.giftRewards).toEqual([{ name: 'Кофе в подарок' }]);
  });
});
