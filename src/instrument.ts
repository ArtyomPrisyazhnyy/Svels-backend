import * as Sentry from '@sentry/nestjs';
import {
  resolveSentryRelease,
  scrubSentryEvent,
} from './config/sentry-event-scrubber';

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: resolveSentryRelease(),
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: (event) => scrubSentryEvent(event) as typeof event,
    beforeSendTransaction: (event) => scrubSentryEvent(event) as typeof event,
  });
}
