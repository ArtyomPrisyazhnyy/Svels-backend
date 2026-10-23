import { UnauthorizedException } from '@nestjs/common';
import { SentryWebhookController } from './sentry-webhook.controller';
import type { SentryWebhookService } from './sentry-webhook.service';
import { computeSentryWebhookSignature } from './sentry-webhook-signature';

describe('SentryWebhookController', () => {
  const secret = 'webhook-secret';
  const rawBody = Buffer.from(
    '{"resource":"issue","action":"created"}',
    'utf8',
  );

  function createController(
    configured = true,
    handlePayload: SentryWebhookService['handlePayload'] = () =>
      Promise.resolve({ handled: true, notified: true }),
  ): SentryWebhookController {
    const service = {
      isWebhookConfigured: () => configured,
      getWebhookSecret: () => secret,
      handlePayload,
    } as unknown as SentryWebhookService;
    return new SentryWebhookController(service);
  }

  it('skips when alerts env is not configured', async () => {
    const controller = createController(false);
    await expect(
      controller.handleWebhook({ rawBody }, undefined, {}),
    ).resolves.toEqual({ ok: true, skipped: true });
  });

  it('returns 401 for invalid signature', async () => {
    const controller = createController(true);
    await expect(
      controller.handleWebhook({ rawBody }, 'bad-signature', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts valid signature and delegates payload', async () => {
    const handlePayload = jest.fn(() =>
      Promise.resolve({ handled: true, notified: true }),
    );
    const controller = createController(true, handlePayload);
    const signature = computeSentryWebhookSignature(rawBody, secret);
    const body = { resource: 'issue', action: 'created' };

    await expect(
      controller.handleWebhook({ rawBody }, signature, body),
    ).resolves.toEqual({ ok: true, notified: true });
    expect(handlePayload).toHaveBeenCalledWith(body);
  });
});
