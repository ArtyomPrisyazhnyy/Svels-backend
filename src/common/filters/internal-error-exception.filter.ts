import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { randomUUID } from 'crypto';
import type { FastifyReply } from 'fastify';

@Catch()
export class InternalErrorExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
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

    const reply = host.switchToHttp().getResponse<FastifyReply>();
    void reply.status(500).send({
      statusCode: 500,
      message: 'Internal error',
      errorId: randomUUID(),
    });
  }
}
