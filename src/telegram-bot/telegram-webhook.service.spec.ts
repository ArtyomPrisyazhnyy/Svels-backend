import { HttpException, HttpStatus } from '@nestjs/common';
import { PreOrderStatus } from '../common/enums/pre-order-status.enum';
import type { IOrdersStaffService } from '../pre-orders/interfaces/orders-staff-service.interface';
import { TelegramWebhookService } from './telegram-webhook.service';
import type { TelegramApiClient } from './telegram-api.client';
import type { TelegramLinkService } from './telegram-link.service';
import type { TelegramOrderNotificationService } from './telegram-order-notification.service';

describe('TelegramWebhookService', () => {
  const restaurantId = '019ef5f4-49d3-757f-9a8a-f9458e52fd66';
  const orderId = '019ef5f4-49d3-757f-9a8a-f9458e52fd65';

  function createService(options: {
    boundRestaurantId?: string | null;
    orderRestaurantId?: string;
    changeStatusImpl?: IOrdersStaffService['changeStatus'];
  }) {
    const answerCallbackQuery = jest.fn();
    const editMessagesForOrder = jest.fn();
    const changeStatus =
      options.changeStatusImpl ??
      jest.fn().mockResolvedValue({
        id: orderId,
        restaurantId: options.orderRestaurantId ?? restaurantId,
        status: PreOrderStatus.ACCEPTED,
      });

    const ordersStaffService: IOrdersStaffService = {
      getById: jest.fn().mockResolvedValue({
        id: orderId,
        restaurantId: options.orderRestaurantId ?? restaurantId,
      }),
      changeStatus,
    };

    const linkService = {
      findRestaurantIdByChatId: jest
        .fn()
        .mockResolvedValue(
          'boundRestaurantId' in options
            ? options.boundRestaurantId
            : restaurantId,
        ),
      bindChatFromStartCommand: jest.fn(),
    } as unknown as TelegramLinkService;

    const telegramApi = {
      answerCallbackQuery,
    } as unknown as TelegramApiClient;

    const orderNotificationService = {
      editMessagesForOrder,
    } as unknown as TelegramOrderNotificationService;

    const service = new TelegramWebhookService(
      telegramApi,
      linkService,
      orderNotificationService,
      ordersStaffService,
    );

    return {
      service,
      answerCallbackQuery,
      changeStatus,
      editMessagesForOrder,
    };
  }

  it('rejects callback from unbound chat', async () => {
    const { service, answerCallbackQuery, changeStatus } = createService({
      boundRestaurantId: null,
    });

    await service.handleUpdate({
      update_id: 1,
      callback_query: {
        id: 'cb1',
        from: { id: 1 },
        message: {
          message_id: 10,
          chat: { id: -100 },
          text: '',
        },
        data: `o:${orderId}:accept`,
      },
    });

    expect(changeStatus).not.toHaveBeenCalled();
    expect(answerCallbackQuery).toHaveBeenCalledWith('cb1', {
      text: 'Этот чат не привязан к заведению',
      showAlert: true,
    });
  });

  it('accepts order from bound chat', async () => {
    const { service, answerCallbackQuery, changeStatus, editMessagesForOrder } =
      createService({});

    await service.handleUpdate({
      update_id: 2,
      callback_query: {
        id: 'cb2',
        from: { id: 1 },
        message: {
          message_id: 11,
          chat: { id: 555 },
          text: '',
        },
        data: `o:${orderId}:accept`,
      },
    });

    expect(changeStatus).toHaveBeenCalledWith({
      restaurantId,
      orderId,
      to: PreOrderStatus.ACCEPTED,
      cancelReason: undefined,
      actor: { type: 'telegram', chatId: '555' },
    });
    expect(editMessagesForOrder).toHaveBeenCalledWith(
      restaurantId,
      orderId,
      false,
    );
    expect(answerCallbackQuery).toHaveBeenCalledWith('cb2', {
      text: 'Заказ принят',
    });
  });

  it('surfaces transition errors to callback query', async () => {
    const { service, answerCallbackQuery } = createService({
      changeStatusImpl: jest.fn().mockRejectedValue(
        new HttpException(
          {
            statusCode: 400,
            message: 'Заказ уже принят',
            error: 'Bad Request',
            code: 'INVALID_TRANSITION',
          },
          HttpStatus.BAD_REQUEST,
        ),
      ),
    });

    await service.handleUpdate({
      update_id: 3,
      callback_query: {
        id: 'cb3',
        from: { id: 1 },
        message: {
          message_id: 12,
          chat: { id: 555 },
          text: '',
        },
        data: `o:${orderId}:accept`,
      },
    });

    expect(answerCallbackQuery).toHaveBeenCalledWith('cb3', {
      text: 'Заказ уже принят',
      showAlert: true,
    });
  });
});
