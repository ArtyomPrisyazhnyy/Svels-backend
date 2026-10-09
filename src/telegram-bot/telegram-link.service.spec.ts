import { createHash } from 'crypto';
import { TelegramLinkService } from './telegram-link.service';
import { RestaurantTelegramChat } from './entities/restaurant-telegram-chat.entity';
import { TelegramLinkCode } from './entities/telegram-link-code.entity';
import type { TelegramApiClient } from './telegram-api.client';

describe('TelegramLinkService', () => {
  const restaurantId = '019ef5f4-49d3-757f-9a8a-f9458e52fd66';

  function createService(deps: {
    linkCodes?: Partial<TelegramLinkCode>[];
    chats?: Partial<RestaurantTelegramChat>[];
    sendMessage?: jest.Mock;
  }) {
    const linkStore = [...(deps.linkCodes ?? [])];
    const chatStore = [...(deps.chats ?? [])];

    const linkCodesRepository = {
      save: jest.fn((entity: TelegramLinkCode) => {
        const idx = linkStore.findIndex((c) => c.codeHash === entity.codeHash);
        if (idx >= 0) {
          linkStore[idx] = { ...linkStore[idx], ...entity };
        } else {
          linkStore.push(entity);
        }
        return Promise.resolve(entity);
      }),
      findOne: jest.fn(({ where }: { where: { codeHash: string } }) =>
        Promise.resolve(
          linkStore.find((c) => c.codeHash === where.codeHash) ?? null,
        ),
      ),
    };

    const chatsRepository = {
      find: jest.fn(({ where }: { where: { restaurantId?: string } }) =>
        Promise.resolve(
          chatStore.filter((c) => c.restaurantId === where.restaurantId),
        ),
      ),
      findOne: jest.fn(
        ({ where }: { where: { restaurantId?: string; chatId?: string } }) =>
          Promise.resolve(
            chatStore.find(
              (c) =>
                (where.restaurantId === undefined ||
                  c.restaurantId === where.restaurantId) &&
                (where.chatId === undefined || c.chatId === where.chatId),
            ) ?? null,
          ),
      ),
      save: jest.fn((entity: RestaurantTelegramChat) => {
        const idx = chatStore.findIndex((c) => c.id === entity.id);
        if (idx >= 0) {
          chatStore[idx] = entity;
        } else {
          chatStore.push({ ...entity, id: entity.id ?? 'chat-row-id' });
        }
        return Promise.resolve(entity);
      }),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
    };

    const telegramApi = {
      getBotUsername: () => 'svels_orders_bot',
      sendMessage: deps.sendMessage ?? jest.fn(),
    } as unknown as TelegramApiClient;

    const service = new TelegramLinkService(
      chatsRepository as never,
      linkCodesRepository as never,
      telegramApi,
    );

    return { service, linkStore, chatStore, telegramApi };
  }

  it('creates link code with deep link and 15 min expiry', async () => {
    const { service } = createService({});
    const result = await service.createLinkCode(restaurantId);

    expect(result.code).toBeTruthy();
    expect(result.deepLink).toBe(
      `https://t.me/svels_orders_bot?start=${result.code}`,
    );
    const expiresMs = new Date(result.expiresAt).getTime() - Date.now();
    expect(expiresMs).toBeGreaterThan(14 * 60 * 1000);
    expect(expiresMs).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it('binds chat when code is valid', async () => {
    const code = 'valid-code';
    const codeHash = createHash('sha256').update(code).digest('hex');
    const sendMessage = jest.fn();
    const { service, linkStore } = createService({
      linkCodes: [
        {
          codeHash,
          restaurantId,
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: null,
        },
      ],
      sendMessage,
    });

    await service.bindChatFromStartCommand('999', code, 'Кухня');

    expect(linkStore[0].usedAt).toBeInstanceOf(Date);
    expect(sendMessage).toHaveBeenCalledWith(
      '999',
      'Чат привязан к заведению. Сюда будут приходить новые заказы.',
    );
  });

  it('rejects expired or used code', async () => {
    const code = 'expired';
    const codeHash = createHash('sha256').update(code).digest('hex');
    const sendMessage = jest.fn();
    const { service } = createService({
      linkCodes: [
        {
          codeHash,
          restaurantId,
          expiresAt: new Date(Date.now() - 1000),
          usedAt: null,
        },
      ],
      sendMessage,
    });

    await service.bindChatFromStartCommand('999', code, null);

    expect(sendMessage).toHaveBeenCalledWith(
      '999',
      'Код привязки недействителен или уже использован. Запросите новый код в панели Svels.',
    );
  });
});
