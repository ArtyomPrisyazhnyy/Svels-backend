import type { PaymentResponseDto } from '../payments/dto/payment.dto';
import type { OrderDto, PreOrderResponseDto } from './dto/pre-order.dto';
import { PreOrderItem } from './entities/pre-order-item.entity';
import { PreOrder } from './entities/pre-order.entity';

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
    totalAmount: Number(order.totalAmount),
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
