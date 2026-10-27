import * as Sentry from '@sentry/nestjs';
import { sentryBeforeSend } from './common/sentry/sentry-before-send';
import { resolveSentryRelease } from './common/sentry/sentry-release.util';

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT?.trim() ||
      process.env.NODE_ENV ||
      'development',
    release: resolveSentryRelease(),
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: sentryBeforeSend,
  });
}
