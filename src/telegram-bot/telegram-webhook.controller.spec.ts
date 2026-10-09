import { UnauthorizedException } from '@nestjs/common';
import { TelegramWebhookController } from './telegram-webhook.controller';
import type { TelegramApiClient } from './telegram-api.client';
import type { TelegramWebhookService } from './telegram-webhook.service';

describe('TelegramWebhookController', () => {
  it('returns 401 when secret token is missing or wrong', async () => {
    const controller = new TelegramWebhookController(
      { handleUpdate: jest.fn() } as unknown as TelegramWebhookService,
      {
        getWebhookSecret: () => 'expected-secret',
      } as unknown as TelegramApiClient,
    );

    await expect(
      controller.handleWebhook(undefined, { update_id: 1 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      controller.handleWebhook('wrong', { update_id: 1 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('delegates update when secret matches', async () => {
    const handleUpdate = jest.fn();
    const controller = new TelegramWebhookController(
      { handleUpdate } as unknown as TelegramWebhookService,
      {
        getWebhookSecret: () => 'expected-secret',
      } as unknown as TelegramApiClient,
    );

    const body = { update_id: 5 };
    await expect(
      controller.handleWebhook('expected-secret', body),
    ).resolves.toEqual({ ok: true });
    expect(handleUpdate).toHaveBeenCalledWith(body);
  });
});
