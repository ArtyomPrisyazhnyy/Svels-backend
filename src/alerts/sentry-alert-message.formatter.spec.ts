import {
  buildSentryAlertTelegramMessage,
  extractSentryAlertContext,
  isActionableSentryWebhook,
  resolveSentryAlertCategoryEmoji,
  shouldSkipIndividualSentryAlert,
} from './sentry-alert-message.formatter';

describe('shouldSkipIndividualSentryAlert', () => {
  it('skips network-class alerts', () => {
    expect(shouldSkipIndividualSentryAlert({ kindTag: 'network' })).toBe(true);
    expect(shouldSkipIndividualSentryAlert({ kindTag: 'server' })).toBe(false);
    expect(shouldSkipIndividualSentryAlert({ kindTag: undefined })).toBe(false);
  });
});

describe('resolveSentryAlertCategoryEmoji', () => {
  it('maps project slugs and kind=network tag', () => {
    expect(resolveSentryAlertCategoryEmoji('svels-backend', undefined)).toBe(
      '🔴 Сервер',
    );
    expect(resolveSentryAlertCategoryEmoji('svels-client', undefined)).toBe(
      '🟠 Сайт',
    );
    expect(resolveSentryAlertCategoryEmoji('svels-mobile', undefined)).toBe(
      '🟣 Мобилка',
    );
    expect(resolveSentryAlertCategoryEmoji('svels-backend', 'network')).toBe(
      '📶 Сеть пользователя',
    );
  });
});

describe('buildSentryAlertTelegramMessage', () => {
  it('formats Russian labels with escaped HTML', () => {
    const text = buildSentryAlertTelegramMessage({
      projectSlug: 'svels-backend',
      environment: 'production',
      release: '1.0.0',
      issue: {
        id: '123',
        title: 'Error <boom>',
        culprit: 'src/app.ts',
        permalink: 'https://sentry.io/issues/123',
        count: 5,
        userCount: 2,
      },
    });

    expect(text).toContain('🔴 Сервер');
    expect(text).toContain('Error &lt;boom&gt;');
    expect(text).toContain('<b>Окружение:</b> production');
    expect(text).toContain('<b>Событий:</b> 5');
    expect(text).toContain('<b>Пользователей:</b> 2');
  });
});

describe('isActionableSentryWebhook', () => {
  it('accepts issue created/triggered and event_alert triggered', () => {
    expect(
      isActionableSentryWebhook({ resource: 'issue', action: 'created' }),
    ).toBe(true);
    expect(
      isActionableSentryWebhook({ resource: 'issue', action: 'triggered' }),
    ).toBe(true);
    expect(
      isActionableSentryWebhook({
        resource: 'event_alert',
        action: 'triggered',
      }),
    ).toBe(true);
    expect(
      isActionableSentryWebhook({ resource: 'event_alert', action: 'created' }),
    ).toBe(false);
  });
});

describe('extractSentryAlertContext', () => {
  it('extracts issue fields from webhook payload', () => {
    const context = extractSentryAlertContext({
      action: 'created',
      resource: 'issue',
      data: {
        issue: {
          id: 'issue-1',
          title: 'Unhandled rejection',
          culprit: 'payments.service.ts',
          web_url: 'https://sentry.io/issues/issue-1',
          count: '3',
          userCount: 1,
          project: { slug: 'svels-backend' },
          metadata: { location: 'payments.service.ts:42' },
        },
        event: {
          environment: 'production',
          release: '0.0.1',
          tags: { kind: 'network' },
        },
      },
    });

    expect(context).toMatchObject({
      projectSlug: 'svels-backend',
      kindTag: 'network',
      environment: 'production',
      release: '0.0.1',
      issue: {
        id: 'issue-1',
        title: 'Unhandled rejection',
      },
    });
  });
});
