import { Injectable, NotImplementedException } from '@nestjs/common';
import type { UserRole } from '../common/enums/user-role.enum';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import type { OrderDto } from './dto/pre-order.dto';
import type { OrderStatusChangedEvent } from './events/order-status-changed.event';
import type { IOrdersStaffService } from './interfaces/orders-staff-service.interface';

@Injectable()
export class PreOrdersStaffService implements IOrdersStaffService {
  getById(restaurantId: string, orderId: string): Promise<OrderDto> {
    void restaurantId;
    void orderId;
    throw new NotImplementedException();
  }

  changeStatus(params: {
    restaurantId: string;
    orderId: string;
    to: PreOrderStatus;
    cancelReason?: string;
    actor: OrderStatusChangedEvent['actor'];
    actorRole?: UserRole;
  }): Promise<OrderDto> {
    void params;
    throw new NotImplementedException();
  }
}
