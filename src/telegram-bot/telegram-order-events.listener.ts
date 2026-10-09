import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ORDER_CREATED_EVENT,
  OrderCreatedEvent,
} from '../pre-orders/events/order-created.event';
import {
  ORDER_STATUS_CHANGED_EVENT,
  OrderStatusChangedEvent,
} from '../pre-orders/events/order-status-changed.event';
import { TelegramOrderNotificationService } from './telegram-order-notification.service';

@Injectable()
export class TelegramOrderEventsListener {
  constructor(
    private readonly notificationService: TelegramOrderNotificationService,
  ) {}

  @OnEvent(ORDER_CREATED_EVENT)
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.notificationService.notifyOrderCreated(
      event.restaurantId,
      event.orderId,
    );
  }

  @OnEvent(ORDER_STATUS_CHANGED_EVENT)
  async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    if (event.actor.type === 'telegram') {
      return;
    }
    await this.notificationService.refreshOrderMessages(
      event.restaurantId,
      event.orderId,
    );
  }
}
