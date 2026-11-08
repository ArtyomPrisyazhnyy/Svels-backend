import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Readable } from 'stream';

export const SENTRY_WEBHOOK_PATH = '/api/internal/sentry-webhook';

export type FastifyRequestWithRawBody = FastifyRequest & {
  rawBody?: Buffer;
};

function isSentryWebhookRequest(url: string): boolean {
  return (
    url === SENTRY_WEBHOOK_PATH || url.startsWith(`${SENTRY_WEBHOOK_PATH}?`)
  );
}

export function registerSentryWebhookRawBody(fastify: FastifyInstance): void {
  fastify.addHook('preParsing', (request, _reply, payload, done) => {
    if (!isSentryWebhookRequest(request.url)) {
      done(null, payload);
      return;
    }

    const chunks: Buffer[] = [];
    payload.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    payload.on('end', () => {
      const rawBody = Buffer.concat(chunks);
      (request as FastifyRequestWithRawBody).rawBody = rawBody;
      done(null, Readable.from(rawBody));
    });
    payload.on('error', (error: Error) => {
      done(error, undefined);
    });
  });
}
