import { SentryAlertDedupeService } from './sentry-alert-dedupe.service';

describe('SentryAlertDedupeService', () => {
  it('dedupes the same issue id within 30 minutes', () => {
    const service = new SentryAlertDedupeService();
    const now = 1_700_000_000_000;

    expect(service.shouldNotify('issue-1', now)).toBe(true);
    expect(service.shouldNotify('issue-1', now + 1_000)).toBe(false);
    expect(service.shouldNotify('issue-1', now + 30 * 60 * 1000)).toBe(true);
    expect(service.shouldNotify('issue-2', now)).toBe(true);
  });
});
