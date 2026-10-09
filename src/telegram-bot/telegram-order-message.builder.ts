import { FulfillmentType } from '../common/enums/fulfillment-type.enum';
import { OrderPaymentStatus } from '../common/enums/order-payment-status.enum';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import type { OrderDto } from '../pre-orders/dto/pre-order.dto';
import type { TelegramInlineKeyboardButton } from './telegram-api.client';
import { escapeTelegramHtml } from './telegram-html.util';

const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  [FulfillmentType.DELIVERY]: 'Доставка',
  [FulfillmentType.TAKEAWAY]: 'Самовывоз',
  [FulfillmentType.DINE_IN]: 'В зале',
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'Наличные',
  [PaymentMethod.CARD]: 'Карта',
  [PaymentMethod.ONLINE]: 'Онлайн',
};

const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  [OrderPaymentStatus.NOT_REQUIRED]: 'не требуется',
  [OrderPaymentStatus.PENDING]: 'ожидает оплаты',
  [OrderPaymentStatus.AUTHORIZED]: 'холд',
  [OrderPaymentStatus.PAID]: 'оплачен',
  [OrderPaymentStatus.VOIDED]: 'отменён',
  [OrderPaymentStatus.FAILED]: 'ошибка оплаты',
};

const ORDER_STATUS_LABELS: Record<PreOrderStatus, string> = {
  [PreOrderStatus.NEW]: 'Новый',
  [PreOrderStatus.ACCEPTED]: 'Принят',
  [PreOrderStatus.PREPARING]: 'Готовится',
  [PreOrderStatus.READY]: 'Готов',
  [PreOrderStatus.COMPLETED]: 'Завершён',
  [PreOrderStatus.CANCELLED]: 'Отменён',
};

export function formatBynAmount(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} BYN`;
}

function formatPaymentLine(order: OrderDto): string {
  const method = PAYMENT_METHOD_LABELS[order.paymentMethod];
  const status = PAYMENT_STATUS_LABELS[order.paymentStatus];
  return `${method}, ${status}`;
}

function formatDeliveryAddress(order: OrderDto): string | null {
  const address = order.deliveryAddress;
  if (!address) {
    return null;
  }
  const parts = [
    `${address.street}, ${address.house}`,
    address.apartment ? `кв. ${address.apartment}` : null,
    address.entrance ? `подъезд ${address.entrance}` : null,
    address.floor ? `этаж ${address.floor}` : null,
    address.intercom ? `домофон ${address.intercom}` : null,
  ].filter(Boolean);
  let line = parts.join(', ');
  if (address.comment) {
    line += ` (${address.comment})`;
  }
  return line;
}

function formatRequestedAt(requestedAt: string | null): string {
  if (!requestedAt) {
    return 'Как можно скорее';
  }
  const date = new Date(requestedAt);
  return date.toLocaleString('ru-RU', {
    timeZone: 'Europe/Minsk',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatItemLines(order: OrderDto): string[] {
  return order.items.map((item) => {
    const modifierLines =
      item.modifiers.length > 0
        ? item.modifiers.map(
            (m) =>
              `  · ${escapeTelegramHtml(m.optionName)} (+${m.priceDelta.toFixed(2)} BYN)`,
          )
        : [];
    const base = `• ${escapeTelegramHtml(item.name)} × ${item.quantity} — ${formatBynAmount(item.lineTotal)}`;
    return modifierLines.length > 0
      ? [base, ...modifierLines].join('\n')
      : base;
  });
}

export function buildOrderTelegramMessage(
  order: OrderDto,
  locationLabel: string | null,
  options?: { showActions?: boolean },
): {
  text: string;
  replyMarkup?: { inline_keyboard: TelegramInlineKeyboardButton[][] };
} {
  const fulfillment = FULFILLMENT_LABELS[order.fulfillmentType];
  const header = [
    `<b>№${order.orderNumber}</b> · ${escapeTelegramHtml(fulfillment)} · ${formatBynAmount(order.totalAmount)}`,
    `${escapeTelegramHtml(formatPaymentLine(order))}`,
    `<b>Статус:</b> ${escapeTelegramHtml(ORDER_STATUS_LABELS[order.status])}`,
  ];

  const lines = [...header, '', ...formatItemLines(order), ''];

  lines.push(
    `<b>Клиент:</b> ${escapeTelegramHtml(order.customerName)}, ${escapeTelegramHtml(order.customerPhone)}`,
  );

  if (order.fulfillmentType === FulfillmentType.DELIVERY) {
    const addressLine = formatDeliveryAddress(order);
    if (addressLine) {
      lines.push(`<b>Адрес:</b> ${escapeTelegramHtml(addressLine)}`);
    }
    if (order.recipientName || order.recipientPhone) {
      const recipient = [order.recipientName, order.recipientPhone]
        .filter(Boolean)
        .join(', ');
      lines.push(`<b>Получатель:</b> ${escapeTelegramHtml(recipient)}`);
    }
  } else if (locationLabel) {
    lines.push(`<b>Точка:</b> ${escapeTelegramHtml(locationLabel)}`);
  }

  lines.push(
    `<b>Время:</b> ${escapeTelegramHtml(formatRequestedAt(order.requestedAt))}`,
  );

  if (order.comment) {
    lines.push(`<b>Комментарий:</b> ${escapeTelegramHtml(order.comment)}`);
  }

  if (order.cancelReason) {
    lines.push(
      `<b>Причина отмены:</b> ${escapeTelegramHtml(order.cancelReason)}`,
    );
  }

  const text = lines.join('\n');
  const showActions =
    options?.showActions !== false && order.status === PreOrderStatus.NEW;

  if (!showActions) {
    return { text };
  }

  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: '✅ Принять',
            callback_data: `o:${order.id}:accept`,
          },
          {
            text: '❌ Отклонить',
            callback_data: `o:${order.id}:reject`,
          },
        ],
      ],
    },
  };
}
