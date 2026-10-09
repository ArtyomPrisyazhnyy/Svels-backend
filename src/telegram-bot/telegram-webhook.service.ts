import { HttpException, Inject, Injectable } from '@nestjs/common';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import { ORDERS_STAFF_SERVICE } from '../common/constants/injection-tokens';
import type { OrderDto } from '../pre-orders/dto/pre-order.dto';
import type { IOrdersStaffService } from '../pre-orders/interfaces/orders-staff-service.interface';
import { TelegramApiClient } from './telegram-api.client';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramOrderNotificationService } from './telegram-order-notification.service';

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  title?: string;
  type?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  text?: string;
  from?: TelegramUser;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

@Injectable()
export class TelegramWebhookService {
  constructor(
    private readonly telegramApi: TelegramApiClient,
    private readonly linkService: TelegramLinkService,
    private readonly orderNotificationService: TelegramOrderNotificationService,
    @Inject(ORDERS_STAFF_SERVICE)
    private readonly ordersStaffService: IOrdersStaffService,
  ) {}

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.message?.text?.startsWith('/start')) {
      await this.handleStartCommand(update.message);
      return;
    }

    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  private async handleStartCommand(message: TelegramMessage): Promise<void> {
    const chatId = String(message.chat.id);
    const title =
      message.chat.title ??
      ([message.from?.first_name, message.from?.last_name]
        .filter(Boolean)
        .join(' ') ||
        message.from?.username ||
        null);

    const parts = (message.text ?? '').trim().split(/\s+/);
    const code = parts.length > 1 ? parts.slice(1).join(' ') : '';
    await this.linkService.bindChatFromStartCommand(chatId, code, title);
  }

  private async handleCallbackQuery(
    callback: TelegramCallbackQuery,
  ): Promise<void> {
    const chatId = callback.message ? String(callback.message.chat.id) : null;
    const data = callback.data ?? '';

    const parsed = parseOrderCallbackData(data);
    if (!parsed || !chatId) {
      await this.telegramApi.answerCallbackQuery(callback.id, {
        text: 'Некорректное действие',
        showAlert: true,
      });
      return;
    }

    const boundRestaurantId =
      await this.linkService.findRestaurantIdByChatId(chatId);
    if (!boundRestaurantId) {
      await this.telegramApi.answerCallbackQuery(callback.id, {
        text: 'Этот чат не привязан к заведению',
        showAlert: true,
      });
      return;
    }

    let order: OrderDto;
    try {
      order = await this.ordersStaffService.getById(
        boundRestaurantId,
        parsed.orderId,
      );
    } catch {
      await this.telegramApi.answerCallbackQuery(callback.id, {
        text: 'Заказ не найден',
        showAlert: true,
      });
      return;
    }

    if (order.restaurantId !== boundRestaurantId) {
      await this.telegramApi.answerCallbackQuery(callback.id, {
        text: 'Заказ относится к другому заведению',
        showAlert: true,
      });
      return;
    }

    const toStatus =
      parsed.action === 'accept'
        ? PreOrderStatus.ACCEPTED
        : PreOrderStatus.CANCELLED;

    try {
      await this.ordersStaffService.changeStatus({
        restaurantId: boundRestaurantId,
        orderId: parsed.orderId,
        to: toStatus,
        cancelReason:
          parsed.action === 'reject' ? 'Отклонено в Telegram' : undefined,
        actor: { type: 'telegram', chatId },
      });
    } catch (error) {
      const message = extractHttpErrorMessage(error);
      await this.telegramApi.answerCallbackQuery(callback.id, {
        text: message,
        showAlert: true,
      });
      return;
    }

    await this.orderNotificationService.editMessagesForOrder(
      boundRestaurantId,
      parsed.orderId,
      false,
    );

    await this.telegramApi.answerCallbackQuery(callback.id, {
      text: parsed.action === 'accept' ? 'Заказ принят' : 'Заказ отклонён',
    });
  }
}

function parseOrderCallbackData(
  data: string,
): { orderId: string; action: 'accept' | 'reject' } | null {
  const match = /^o:([^:]+):(accept|reject)$/.exec(data);
  if (!match) {
    return null;
  }
  return { orderId: match[1], action: match[2] as 'accept' | 'reject' };
}

function extractHttpErrorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message: string | string[] }).message;
      return Array.isArray(message) ? message.join(', ') : message;
    }
  }
  return 'Не удалось изменить статус заказа';
}
