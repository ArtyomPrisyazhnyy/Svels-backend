import { PreOrderStatus } from '../../common/enums/pre-order-status.enum';

export const ORDER_STATUS_CHANGED_EVENT = 'order.status_changed';

export class OrderStatusChangedEvent {
  orderId: string;
  restaurantId: string;
  orderNumber: number;
  from: PreOrderStatus;
  to: PreOrderStatus;
  actor: {
    type: 'staff' | 'telegram' | 'system' | 'payment';
    userId?: string;
    chatId?: string;
  };

  constructor(params: {
    orderId: string;
    restaurantId: string;
    orderNumber: number;
    from: PreOrderStatus;
    to: PreOrderStatus;
    actor: OrderStatusChangedEvent['actor'];
  }) {
    this.orderId = params.orderId;
    this.restaurantId = params.restaurantId;
    this.orderNumber = params.orderNumber;
    this.from = params.from;
    this.to = params.to;
    this.actor = params.actor;
  }
}
