import { HttpException } from '@nestjs/common';
import type { ErrorEvent, EventHint } from '@sentry/nestjs';

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-guest-id',
]);

export function shouldDropSentryEvent(exception: unknown): boolean {
  if (!(exception instanceof HttpException)) {
    return false;
  }
  return exception.getStatus() < 500;
}

function scrubRequestHeaders(event: ErrorEvent): void {
  const headers = event.request?.headers;
  if (!headers || typeof headers !== 'object') {
    return;
  }

  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) {
      delete headers[key];
    }
  }
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    scrubRequestHeaders(event);
  }
  return event;
}

export function sentryBeforeSend(
  event: ErrorEvent,
  hint: EventHint,
): ErrorEvent | null {
  if (shouldDropSentryEvent(hint.originalException)) {
    return null;
  }
  return scrubSentryEvent(event);
}
