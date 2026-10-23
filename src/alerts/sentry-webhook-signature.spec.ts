import {
  computeSentryWebhookSignature,
  verifySentryWebhookSignature,
} from './sentry-webhook-signature';

describe('sentry webhook signature', () => {
  const secret = 'test-webhook-secret';
  const rawBody = Buffer.from('{"action":"created"}', 'utf8');

  it('computes HMAC-SHA256 hex digest', () => {
    const signature = computeSentryWebhookSignature(rawBody, secret);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(signature).toBe(computeSentryWebhookSignature(rawBody, secret));
  });

  it('accepts a valid signature', () => {
    const signature = computeSentryWebhookSignature(rawBody, secret);
    expect(verifySentryWebhookSignature(rawBody, signature, secret)).toBe(true);
  });

  it('rejects invalid signature', () => {
    expect(verifySentryWebhookSignature(rawBody, 'deadbeef', secret)).toBe(
      false,
    );
    expect(verifySentryWebhookSignature(rawBody, undefined, secret)).toBe(
      false,
    );
    expect(verifySentryWebhookSignature(undefined, 'abc', secret)).toBe(false);
  });
});
