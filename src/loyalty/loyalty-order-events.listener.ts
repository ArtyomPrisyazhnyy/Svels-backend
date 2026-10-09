import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import { LoyaltySettingsService } from '../loyalty-settings/loyalty-settings.service';
import {
  ORDER_STATUS_CHANGED_EVENT,
  OrderStatusChangedEvent,
} from '../pre-orders/events/order-status-changed.event';
import { LoyaltyService } from './loyalty.service';

@Injectable()
export class LoyaltyOrderEventsListener {
  private readonly logger = new Logger(LoyaltyOrderEventsListener.name);

  constructor(
    private readonly loyaltySettingsService: LoyaltySettingsService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  @OnEvent(ORDER_STATUS_CHANGED_EVENT)
  async onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
    try {
      if (event.to !== PreOrderStatus.COMPLETED || !event.userId) {
        return;
      }

      const settings = await this.loyaltySettingsService.getByRestaurant(
        event.restaurantId,
      );
      if (!settings.flameDisplayEnabled) {
        return;
      }

      await this.loyaltyService.recordVisit({
        restaurantId: event.restaurantId,
        userId: event.userId,
        orderId: event.orderId,
        expireDays: settings.flameExpireDays,
        now: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Не удалось записать визит лояльности по заказу ${event.orderId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
