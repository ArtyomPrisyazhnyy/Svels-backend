import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderPaymentStatus } from '../common/enums/order-payment-status.enum';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import type { UserRole } from '../common/enums/user-role.enum';
import { PaymentsService } from '../payments/payments.service';
import { sanitizeText } from '../common/utils/sanitize.util';
import type { StaffPreOrdersListResponse } from './dto/staff-list-pre-orders-query.dto';
import type { OrderDto } from './dto/pre-order.dto';
import { PreOrderItem } from './entities/pre-order-item.entity';
import { PreOrder } from './entities/pre-order.entity';
import {
  ORDER_STATUS_CHANGED_EVENT,
  OrderStatusChangedEvent,
} from './events/order-status-changed.event';
import type { IOrdersStaffService } from './interfaces/orders-staff-service.interface';
import { mapPreOrderToOrderDto } from './pre-order.mapper';
import { minsDayBoundsInMinsk } from './pricing/minsk-time.util';
import { isStatusTransitionAllowed } from './staff/order-status-transitions';
import {
  throwInvalidTransition,
  throwPaidOrderCancelNotSupported,
} from './staff/pre-order-conflict.util';
import { throwOrderBusinessError } from './utils/order-business-error.util';

@Injectable()
export class PreOrdersStaffService implements IOrdersStaffService {
  constructor(
    @InjectRepository(PreOrder)
    private readonly preOrderRepository: Repository<PreOrder>,
    @InjectRepository(PreOrderItem)
    private readonly preOrderItemRepository: Repository<PreOrderItem>,
    private readonly paymentsService: PaymentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listForRestaurant(
    restaurantId: string,
    query: {
      status?: string;
      date?: string;
      updatedSince?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<StaffPreOrdersListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.preOrderRepository
      .createQueryBuilder('order')
      .where('order.restaurantId = :restaurantId', { restaurantId });

    const statuses = this.parseStatusFilter(query.status);
    if (statuses.length) {
      qb.andWhere('order.status IN (:...statuses)', { statuses });
    }

    if (query.date) {
      const { start, end } = minsDayBoundsInMinsk(query.date);
      qb.andWhere('order.createdAt BETWEEN :start AND :end', { start, end });
    }

    if (query.updatedSince) {
      const since = new Date(query.updatedSince);
      if (Number.isNaN(since.getTime())) {
        throwOrderBusinessError(
          'VALIDATION',
          'Некорректный параметр updatedSince',
        );
      }
      qb.andWhere('order.updatedAt > :updatedSince', { updatedSince: since });
    }

    qb.orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [orders, total] = await qb.getManyAndCount();
    const items = await this.loadItemsForOrders(orders);
    const itemsByOrder = this.groupItemsByOrder(items);

    return {
      items: orders.map((order) =>
        mapPreOrderToOrderDto(order, itemsByOrder.get(order.id) ?? []),
      ),
      total,
      page,
      limit,
      serverTime: new Date().toISOString(),
    };
  }

  async getById(restaurantId: string, orderId: string): Promise<OrderDto> {
    const order = await this.findOrderForRestaurant(restaurantId, orderId);
    const items = await this.preOrderItemRepository.find({
      where: { preOrderId: order.id },
    });
    return mapPreOrderToOrderDto(order, items);
  }

  async changeStatus(params: {
    restaurantId: string;
    orderId: string;
    to: PreOrderStatus;
    cancelReason?: string;
    actor: OrderStatusChangedEvent['actor'];
    actorRole?: UserRole;
  }): Promise<OrderDto> {
    const order = await this.findOrderForRestaurant(
      params.restaurantId,
      params.orderId,
    );
    const from = order.status;

    if (from === params.to) {
      return this.getById(params.restaurantId, params.orderId);
    }

    if (params.to === PreOrderStatus.CANCELLED) {
      if (order.paymentStatus === OrderPaymentStatus.PAID) {
        throwPaidOrderCancelNotSupported();
      }
      const reason = params.cancelReason?.trim();
      if (!reason || reason.length < 1 || reason.length > 300) {
        throwOrderBusinessError(
          'VALIDATION',
          'Укажите причину отмены (до 300 символов)',
        );
      }
    }

    if (
      !isStatusTransitionAllowed({
        from,
        to: params.to,
        actor: params.actor,
        actorRole: params.actorRole,
      })
    ) {
      throwInvalidTransition();
    }

    const now = new Date();
    order.status = params.to;
    order.statusChangedAt = now;
    if (params.to === PreOrderStatus.CANCELLED) {
      order.cancelReason = sanitizeText(params.cancelReason!.trim());
    }

    await this.preOrderRepository.save(order);

    if (
      params.to === PreOrderStatus.ACCEPTED &&
      order.paymentStatus === OrderPaymentStatus.AUTHORIZED
    ) {
      await this.paymentsService.captureByPreOrder(
        params.restaurantId,
        order.id,
      );
    }

    if (
      params.to === PreOrderStatus.CANCELLED &&
      order.paymentStatus === OrderPaymentStatus.AUTHORIZED
    ) {
      await this.paymentsService.voidByPreOrder(params.restaurantId, order.id);
    }

    this.eventEmitter.emit(
      ORDER_STATUS_CHANGED_EVENT,
      new OrderStatusChangedEvent({
        orderId: order.id,
        restaurantId: order.restaurantId,
        orderNumber: order.orderNumber,
        from,
        to: params.to,
        actor: params.actor,
      }),
    );

    const refreshed = await this.preOrderRepository.findOne({
      where: { id: order.id },
    });
    const items = await this.preOrderItemRepository.find({
      where: { preOrderId: order.id },
    });
    return mapPreOrderToOrderDto(refreshed ?? order, items);
  }

  private async findOrderForRestaurant(
    restaurantId: string,
    orderId: string,
  ): Promise<PreOrder> {
    const order = await this.preOrderRepository.findOne({
      where: { id: orderId },
    });
    if (!order || order.restaurantId !== restaurantId) {
      if (order && order.restaurantId !== restaurantId) {
        throw new ForbiddenException('Нет доступа к этому заказу');
      }
      throw new NotFoundException('Предзаказ не найден');
    }
    return order;
  }

  private parseStatusFilter(raw?: string): PreOrderStatus[] {
    if (!raw?.trim()) {
      return [];
    }
    const values = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const allowed = new Set(Object.values(PreOrderStatus));
    const statuses: PreOrderStatus[] = [];
    for (const value of values) {
      if (!allowed.has(value as PreOrderStatus)) {
        throwOrderBusinessError('VALIDATION', `Неизвестный статус: ${value}`);
      }
      statuses.push(value as PreOrderStatus);
    }
    return statuses;
  }

  private async loadItemsForOrders(
    orders: PreOrder[],
  ): Promise<PreOrderItem[]> {
    if (!orders.length) {
      return [];
    }
    return this.preOrderItemRepository.find({
      where: { preOrderId: In(orders.map((o) => o.id)) },
    });
  }

  private groupItemsByOrder(
    items: PreOrderItem[],
  ): Map<string, PreOrderItem[]> {
    const map = new Map<string, PreOrderItem[]>();
    for (const item of items) {
      const list = map.get(item.preOrderId) ?? [];
      list.push(item);
      map.set(item.preOrderId, list);
    }
    return map;
  }
}
