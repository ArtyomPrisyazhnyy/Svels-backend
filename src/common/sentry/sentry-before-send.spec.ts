import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { sentryBeforeSend, shouldDropSentryEvent } from './sentry-before-send';

describe('sentry beforeSend', () => {
  it('drops expected HttpException below 500', () => {
    expect(shouldDropSentryEvent(new BadRequestException())).toBe(true);
    expect(shouldDropSentryEvent(new NotFoundException())).toBe(true);
    expect(shouldDropSentryEvent(new HttpException('conflict', 409))).toBe(
      true,
    );
    expect(shouldDropSentryEvent(new HttpException('throttled', 429))).toBe(
      true,
    );
    expect(shouldDropSentryEvent(new HttpException('boom', 500))).toBe(false);
    expect(shouldDropSentryEvent(new Error('x'))).toBe(false);
  });

  it('scrubs cookies and sensitive headers', () => {
    const event = sentryBeforeSend(
      {
        request: {
          cookies: { session: 'secret' },
          headers: {
            authorization: 'Bearer token',
            cookie: 'a=b',
            'content-type': 'application/json',
          },
          data: { password: 'x' },
        },
      },
      { originalException: new Error('fail') },
    );

    expect(event?.request?.cookies).toBeUndefined();
    expect(event?.request?.data).toBeUndefined();
    expect(event?.request?.headers).toEqual({
      'content-type': 'application/json',
    });
  });

  it('returns null for dropped events', () => {
    expect(
      sentryBeforeSend(
        { request: {} },
        { originalException: new NotFoundException() },
      ),
    ).toBeNull();
  });
});
