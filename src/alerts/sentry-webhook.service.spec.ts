import { ConfigService } from '@nestjs/config';
import { SentryAlertDedupeService } from './sentry-alert-dedupe.service';
import { SentryTelegramNotifierService } from './sentry-telegram-notifier.service';
import { SentryWebhookService } from './sentry-webhook.service';

describe('SentryWebhookService', () => {
  const payload = {
    action: 'created',
    resource: 'issue',
    data: {
      issue: {
        id: 'issue-1',
        title: 'Boom',
        project: { slug: 'svels-backend' },
      },
    },
  };

  function createService(
    config: Record<string, string>,
    notifyImpl: () => Promise<boolean> = () => Promise.resolve(true),
  ): SentryWebhookService {
    const configService = {
      get: (key: string, defaultValue = '') => config[key] ?? defaultValue,
    } as ConfigService;
    const telegram = {
      isConfigured: () =>
        Boolean(
          config['alerts.errorsTelegramBotToken'] &&
          config['alerts.errorsTelegramChatId'],
        ),
      notify: notifyImpl,
    } as unknown as SentryTelegramNotifierService;
    return new SentryWebhookService(
      configService,
      new SentryAlertDedupeService(),
      telegram,
    );
  }

  it('is no-op when env is missing', async () => {
    const service = createService({});
    expect(service.isWebhookConfigured()).toBe(false);
    await expect(service.handlePayload(payload)).resolves.toEqual({
      handled: false,
      notified: false,
    });
  });

  it('notifies telegram when configured', async () => {
    const notify = jest.fn(() => Promise.resolve(true));
    const service = createService(
      {
        'alerts.sentryWebhookSecret': 'secret',
        'alerts.errorsTelegramBotToken': 'token',
        'alerts.errorsTelegramChatId': 'chat',
      },
      notify,
    );

    await expect(service.handlePayload(payload)).resolves.toEqual({
      handled: true,
      notified: true,
    });
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
