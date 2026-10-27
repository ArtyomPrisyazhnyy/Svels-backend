import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { randomUUID } from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { applyServerErrorScope } from '../sentry/server-error-scope';

type FastifyRequestWithUser = FastifyRequest & {
  user?: { restaurantId?: string };
};

@Catch()
export class SvelsSentryExceptionFilter extends SentryGlobalFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      super.catch(exception, host);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status < 500) {
        super.catch(exception, host);
        return;
      }
    }

    const request = host.switchToHttp().getRequest<FastifyRequestWithUser>();
    const errorId =
      Sentry.withScope((scope) => {
        applyServerErrorScope(scope, request);
        return Sentry.captureException(exception);
      }) ??
      Sentry.lastEventId() ??
      randomUUID();

    const reply = host.switchToHttp().getResponse<FastifyReply>();
    void reply.status(500).send({
      statusCode: 500,
      message: 'Internal error',
      errorId,
    });
  }
}
