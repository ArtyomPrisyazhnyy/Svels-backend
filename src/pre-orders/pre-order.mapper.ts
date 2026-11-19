import type { PaymentResponseDto } from '../payments/dto/payment.dto';
import type { OrderDto, PreOrderResponseDto } from './dto/pre-order.dto';
import { PreOrderItem } from './entities/pre-order-item.entity';
import { PreOrder } from './entities/pre-order.entity';
import type {
  CartGiftReward,
  CartLoyaltyDiscount,
  LoyaltyRewardSnapshot,
} from './pricing/cart-quote.util';

export function mapPreOrderItemToDto(
  item: PreOrderItem,
): OrderDto['items'][number] {
  const unitPrice = Number(item.unitPrice);
  return {
    id: item.id,
    menuItemId: item.menuItemId,
    name: item.name,
    quantity: item.quantity,
    unitPrice,
    modifiers: item.modifiers ?? [],
    lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
  };
}

export function mapPreOrderToOrderDto(
  order: PreOrder,
  items: PreOrderItem[],
): OrderDto {
  return {
    id: order.id,
    restaurantId: order.restaurantId,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    fulfillmentType: order.fulfillmentType,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    deliveryAddress: order.deliveryAddress,
    locationId: order.locationId,
    requestedAt: order.requestedAt ? order.requestedAt.toISOString() : null,
    comment: order.comment,
    cancelReason: order.cancelReason,
    ...mapLoyaltyFields(order),
    totalAmount: toMoney(order.totalAmount),
    items: items.map(mapPreOrderItemToDto),
    bookingId: order.bookingId,
    statusChangedAt: order.statusChangedAt.toISOString(),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function mapPreOrderToResponseDto(
  order: PreOrder,
  items: PreOrderItem[],
  payment: PaymentResponseDto | null,
  paymentRedirectUrl: string | null,
): PreOrderResponseDto {
  return {
    ...mapPreOrderToOrderDto(order, items),
    payment,
    paymentRedirectUrl,
  };
}

function mapLoyaltyFields(order: PreOrder): {
  subtotalAmount: number;
  loyaltyDiscountAmount: number;
  loyaltyLevelId: string | null;
  loyaltyLevelName: string | null;
  loyaltyDiscount: CartLoyaltyDiscount | null;
  giftRewards: CartGiftReward[];
} {
  const snapshot = readSnapshot(order.loyaltyRewardSnapshot);
  const loyaltyDiscountAmount = toMoney(order.loyaltyDiscountAmount);
  const totalAmount = toMoney(order.totalAmount);
  let subtotalAmount = toMoney(order.subtotalAmount);

  // Заказы до колонки скидки: в БД 0, снимок пустой, итог уже был полной суммой.
  if (
    subtotalAmount === 0 &&
    loyaltyDiscountAmount === 0 &&
    snapshot == null &&
    !order.loyaltyLevelName &&
    totalAmount > 0
  ) {
    subtotalAmount = totalAmount;
  }

  return {
    subtotalAmount,
    loyaltyDiscountAmount,
    loyaltyLevelId: order.loyaltyLevelId ?? null,
    loyaltyLevelName: order.loyaltyLevelName ?? null,
    loyaltyDiscount: snapshot?.discount ?? null,
    giftRewards: snapshot?.gifts ?? [],
  };
}

function readSnapshot(
  value: LoyaltyRewardSnapshot | null | undefined,
): LoyaltyRewardSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const gifts = Array.isArray(value.gifts) ? value.gifts : [];
  return {
    discount: value.discount ?? null,
    gifts,
  };
}

function toMoney(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
