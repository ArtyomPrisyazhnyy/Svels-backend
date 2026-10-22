import { scrubSentryEvent } from './sentry-event-scrubber';

describe('scrubSentryEvent', () => {
  it('redacts auth headers, emails, phones, and tokens', () => {
    const event = scrubSentryEvent({
      user: {
        email: 'user@example.com',
        username: 'user@example.com',
        ip_address: '203.0.113.1',
      },
      request: {
        headers: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.a.b',
          Cookie: 'session=secret',
        },
        data: {
          phone: '+375 29 000-00-01',
          note: 'contact user@example.com',
        },
      },
      extra: {
        accessToken: 'super-secret',
      },
      message: 'Failed for +375 29 000-00-02',
    });

    expect(event.user?.email).toBeUndefined();
    expect(event.request?.headers?.Authorization).toBe('[redacted]');
    expect(event.request?.data).toEqual({
      phone: '[redacted]',
      note: 'contact [email]',
    });
    expect(event.extra).toEqual({ accessToken: '[redacted]' });
    expect(event.message).toBe('Failed for [phone]');
  });
});
