import type { UserRole } from '../../common/enums/user-role.enum';
import { PreOrderStatus } from '../../common/enums/pre-order-status.enum';
import type { OrderDto } from '../dto/pre-order.dto';
import type { OrderStatusChangedEvent } from '../events/order-status-changed.event';

export interface IOrdersStaffService {
  getById(restaurantId: string, orderId: string): Promise<OrderDto>;
  changeStatus(params: {
    restaurantId: string;
    orderId: string;
    to: PreOrderStatus;
    cancelReason?: string;
    actor: OrderStatusChangedEvent['actor'];
    actorRole?: UserRole;
  }): Promise<OrderDto>;
}
