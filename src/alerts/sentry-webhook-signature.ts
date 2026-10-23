import { createHmac, timingSafeEqual } from 'crypto';

export function computeSentryWebhookSignature(
  rawBody: Buffer,
  secret: string,
): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifySentryWebhookSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!rawBody || !signatureHeader?.trim() || !secret) {
    return false;
  }

  const expected = computeSentryWebhookSignature(rawBody, secret);
  const provided = signatureHeader.trim();

  if (expected.length !== provided.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(provided, 'utf8'),
    );
  } catch {
    return false;
  }
}
