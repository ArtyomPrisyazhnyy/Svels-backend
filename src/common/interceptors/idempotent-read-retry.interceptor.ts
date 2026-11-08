import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';
import { isPgTransientConnectionError } from '../../database/pg-connection-retry.util';

function shouldSkipReadRetry(context: ExecutionContext): boolean {
  const req = context.switchToHttp().getRequest<{
    method?: string;
    url?: string;
    routerPath?: string;
  }>();
  if (req.method !== 'GET') {
    return true;
  }

  const path = (req.routerPath ?? req.url ?? '').split('?')[0];
  return path === '/health' || path === '/ask';
}

@Injectable()
export class IdempotentReadRetryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (shouldSkipReadRetry(context)) {
      return next.handle();
    }

    return next.handle().pipe(
      catchError((error: unknown) => {
        if (!isPgTransientConnectionError(error)) {
          return throwError(() => error);
        }
        return next.handle();
      }),
    );
  }
}
