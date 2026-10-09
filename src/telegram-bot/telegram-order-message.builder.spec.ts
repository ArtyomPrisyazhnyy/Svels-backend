import { FulfillmentType } from '../common/enums/fulfillment-type.enum';
import { OrderPaymentStatus } from '../common/enums/order-payment-status.enum';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import type { OrderDto } from '../pre-orders/dto/pre-order.dto';
import { escapeTelegramHtml } from './telegram-html.util';
import {
  buildOrderTelegramMessage,
  formatBynAmount,
} from './telegram-order-message.builder';

function baseOrder(overrides: Partial<OrderDto> = {}): OrderDto {
  return {
    id: '019ef5f4-49d3-757f-9a8a-f9458e52fd65',
    restaurantId: '019ef5f4-49d3-757f-9a8a-f9458e52fd66',
    orderNumber: 42,
    status: PreOrderStatus.NEW,
    paymentMethod: PaymentMethod.CASH,
    paymentStatus: OrderPaymentStatus.NOT_REQUIRED,
    fulfillmentType: FulfillmentType.DELIVERY,
    customerName: 'Иван',
    customerPhone: '+375290000000',
    recipientName: null,
    recipientPhone: null,
    deliveryAddress: {
      street: 'Ленина',
      house: '1',
      apartment: '5',
    },
    locationId: null,
    requestedAt: '2026-10-09T10:30:00.000Z',
    comment: 'Без лука',
    cancelReason: null,
    totalAmount: 25.5,
    items: [
      {
        id: '019ef5f4-49d3-757f-9a8a-f9458e52fd67',
        menuItemId: '019ef5f4-49d3-757f-9a8a-f9458e52fd68',
        name: 'Бургер <VIP>',
        quantity: 2,
        unitPrice: 10,
        modifiers: [
          {
            groupName: 'Соус',
            optionName: 'Сырный & острый',
            priceDelta: 2.75,
          },
        ],
        lineTotal: 25.5,
      },
    ],
    bookingId: null,
    statusChangedAt: '2026-10-09T10:00:00.000Z',
    createdAt: '2026-10-09T10:00:00.000Z',
    updatedAt: '2026-10-09T10:00:00.000Z',
    ...overrides,
  };
}

describe('telegram order message builder', () => {
  it('escapes Telegram HTML', () => {
    expect(escapeTelegramHtml('Tom & <Jerry>')).toBe('Tom &amp; &lt;Jerry&gt;');
  });

  it('formats BYN amounts with comma decimal separator', () => {
    expect(formatBynAmount(25.5)).toBe('25,50 BYN');
  });

  it('builds message with modifiers and escaped names', () => {
    const order = baseOrder();
    const { text, replyMarkup } = buildOrderTelegramMessage(order, null);

    expect(text).toContain('<b>№42</b>');
    expect(text).toContain('Доставка');
    expect(text).toContain('25,50 BYN');
    expect(text).toContain('Бургер &lt;VIP&gt;');
    expect(text).toContain('Сырный &amp; острый');
    expect(text).toContain('<b>Адрес:</b> Ленина, 1, кв. 5');
    expect(text).toContain('<b>Комментарий:</b> Без лука');
    const buttons = replyMarkup?.inline_keyboard[0] ?? [];
    expect(buttons.map((button) => button.callback_data)).toEqual([
      `o:${order.id}:accept`,
      `o:${order.id}:reject`,
    ]);
  });

  it('shows location label for takeaway', () => {
    const { text } = buildOrderTelegramMessage(
      baseOrder({
        fulfillmentType: FulfillmentType.TAKEAWAY,
        deliveryAddress: null,
        locationId: '019ef5f4-49d3-757f-9a8a-f9458e52fd70',
      }),
      'Центр, ул. Советская 10',
    );

    expect(text).toContain('<b>Точка:</b> Центр, ул. Советская 10');
    expect(text).not.toContain('<b>Адрес:</b>');
  });

  it('omits action buttons when status is not new', () => {
    const { replyMarkup } = buildOrderTelegramMessage(
      baseOrder({ status: PreOrderStatus.ACCEPTED }),
      null,
      { showActions: false },
    );
    expect(replyMarkup).toBeUndefined();
  });
});
