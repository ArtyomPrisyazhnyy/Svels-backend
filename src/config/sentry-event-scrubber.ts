import type { Event } from '@sentry/core';

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-guest-id',
]);

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /\+?\d[\d\s()-]{7,}\d/g;
const BEARER_PATTERN = /Bearer\s+\S+/gi;
const JWT_LIKE_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|cookie|phone|email|otp|bearer)/i;

function scrubString(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[email]')
    .replace(PHONE_PATTERN, '[phone]')
    .replace(BEARER_PATTERN, '[token]')
    .replace(JWT_LIKE_PATTERN, '[token]');
}

function scrubValue(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    if (key && SENSITIVE_KEY_PATTERN.test(key)) {
      return '[redacted]';
    }
    return scrubString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item));
  }

  if (value && typeof value === 'object') {
    return scrubObject(value as Record<string, unknown>);
  }

  return value;
}

function scrubObject(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(record)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[redacted]';
      continue;
    }
    result[key] = scrubValue(nested, key);
  }
  return result;
}

function scrubRequestHeaders(
  headers: Record<string, string> | undefined | null,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }
  const scrubbed: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) {
      scrubbed[name] = '[redacted]';
      continue;
    }
    scrubbed[name] = scrubString(value);
  }
  return scrubbed;
}

export function scrubSentryEvent(event: Event): Event {
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
  }

  if (event.request) {
    event.request.headers = scrubRequestHeaders(event.request.headers);
    if (typeof event.request.data === 'string') {
      event.request.data = scrubString(event.request.data);
    } else if (event.request.data && typeof event.request.data === 'object') {
      event.request.data = scrubObject(
        event.request.data as Record<string, unknown>,
      );
    }
    if (event.request.cookies) {
      event.request.cookies = { redacted: '[redacted]' };
    }
    if (
      event.request.query_string &&
      typeof event.request.query_string === 'string'
    ) {
      event.request.query_string = scrubString(event.request.query_string);
    }
  }

  if (event.extra) {
    event.extra = scrubObject(event.extra);
  }

  if (event.contexts) {
    event.contexts = scrubObject(event.contexts) as typeof event.contexts;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message ? scrubString(crumb.message) : crumb.message,
      data: crumb.data
        ? scrubObject(crumb.data as Record<string, unknown>)
        : crumb.data,
    }));
  }

  if (event.message && typeof event.message === 'string') {
    event.message = scrubString(event.message);
  }

  return event;
}

export function resolveSentryRelease(): string | undefined {
  const raw =
    process.env.SENTRY_RELEASE?.trim() ||
    process.env.GIT_SHA?.trim() ||
    process.env.COMMIT_SHA?.trim();
  return raw || undefined;
}
