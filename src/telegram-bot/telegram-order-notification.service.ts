import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ORDERS_STAFF_SERVICE } from '../common/constants/injection-tokens';
import type { IOrdersStaffService } from '../pre-orders/interfaces/orders-staff-service.interface';
import { RestaurantLocation } from '../restaurants/entities/restaurant-location.entity';
import { TelegramApiClient } from './telegram-api.client';
import { TelegramOrderMessage } from './entities/telegram-order-message.entity';
import { TelegramLinkService } from './telegram-link.service';
import { buildOrderTelegramMessage } from './telegram-order-message.builder';

@Injectable()
export class TelegramOrderNotificationService {
  constructor(
    private readonly telegramApi: TelegramApiClient,
    private readonly linkService: TelegramLinkService,
    @Inject(ORDERS_STAFF_SERVICE)
    private readonly ordersStaffService: IOrdersStaffService,
    @InjectRepository(TelegramOrderMessage)
    private readonly orderMessagesRepository: Repository<TelegramOrderMessage>,
    @InjectRepository(RestaurantLocation)
    private readonly locationsRepository: Repository<RestaurantLocation>,
  ) {}

  async notifyOrderCreated(
    restaurantId: string,
    orderId: string,
  ): Promise<void> {
    if (!this.telegramApi.isConfigured()) {
      return;
    }

    const chatIds =
      await this.linkService.listChatIdsForRestaurant(restaurantId);
    if (chatIds.length === 0) {
      return;
    }

    const order = await this.ordersStaffService.getById(restaurantId, orderId);
    const locationLabel = await this.resolveLocationLabel(order);

    const { text, replyMarkup } = buildOrderTelegramMessage(
      order,
      locationLabel,
      {
        showActions: true,
      },
    );

    for (const chatId of chatIds) {
      const messageId = await this.telegramApi.sendMessage(chatId, text, {
        replyMarkup,
      });
      if (messageId != null) {
        await this.orderMessagesRepository.save({
          orderId: order.id,
          chatId,
          messageId: String(messageId),
        });
      }
    }
  }

  async refreshOrderMessages(
    restaurantId: string,
    orderId: string,
  ): Promise<void> {
    if (!this.telegramApi.isConfigured()) {
      return;
    }

    const bindings = await this.orderMessagesRepository.find({
      where: { orderId },
    });
    if (bindings.length === 0) {
      return;
    }

    const order = await this.ordersStaffService.getById(restaurantId, orderId);
    const locationLabel = await this.resolveLocationLabel(order);
    const { text } = buildOrderTelegramMessage(order, locationLabel, {
      showActions: false,
    });

    for (const binding of bindings) {
      await this.telegramApi.editMessageText(
        binding.chatId,
        binding.messageId,
        text,
        { replyMarkup: null },
      );
    }
  }

  async editMessagesForOrder(
    restaurantId: string,
    orderId: string,
    showActions: boolean,
  ): Promise<void> {
    if (!this.telegramApi.isConfigured()) {
      return;
    }

    const bindings = await this.orderMessagesRepository.find({
      where: { orderId },
    });
    if (bindings.length === 0) {
      return;
    }

    const order = await this.ordersStaffService.getById(restaurantId, orderId);
    const locationLabel = await this.resolveLocationLabel(order);
    const { text, replyMarkup } = buildOrderTelegramMessage(
      order,
      locationLabel,
      { showActions },
    );

    for (const binding of bindings) {
      await this.telegramApi.editMessageText(
        binding.chatId,
        binding.messageId,
        text,
        { replyMarkup: showActions ? (replyMarkup ?? null) : null },
      );
    }
  }

  private async resolveLocationLabel(
    order: Awaited<ReturnType<IOrdersStaffService['getById']>>,
  ): Promise<string | null> {
    if (!order.locationId) {
      return null;
    }
    const location = await this.locationsRepository.findOne({
      where: { id: order.locationId, restaurantId: order.restaurantId },
    });
    if (!location) {
      return null;
    }
    return location.label ?? `${location.city}, ${location.address}`;
  }
}
