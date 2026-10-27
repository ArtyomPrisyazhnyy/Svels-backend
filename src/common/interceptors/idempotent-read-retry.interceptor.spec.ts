import { of, throwError } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { IdempotentReadRetryInterceptor } from './idempotent-read-retry.interceptor';

describe('IdempotentReadRetryInterceptor', () => {
  const interceptor = new IdempotentReadRetryInterceptor();

  const createContext = (method: string, url: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method, url, routerPath: url }),
      }),
    }) as ExecutionContext;

  it('retries GET once on transient connection error', (done) => {
    const enotfound = Object.assign(new Error('ENOTFOUND'), {
      code: 'ENOTFOUND',
    });
    const handleMock = jest
      .fn()
      .mockReturnValueOnce(throwError(() => enotfound))
      .mockReturnValueOnce(of({ ok: true }));
    const handler: CallHandler = { handle: handleMock };

    interceptor
      .intercept(createContext('GET', '/users/me/pre-orders'), handler)
      .subscribe({
        next: (value) => {
          expect(value).toEqual({ ok: true });
          expect(handleMock).toHaveBeenCalledTimes(2);
          done();
        },
        error: () => {
          done(new Error('expected success'));
        },
      });
  });

  it('does not retry /health', (done) => {
    const enotfound = Object.assign(new Error('ENOTFOUND'), {
      code: 'ENOTFOUND',
    });
    const handleMock = jest.fn().mockReturnValue(throwError(() => enotfound));
    const handler: CallHandler = { handle: handleMock };

    interceptor.intercept(createContext('GET', '/health'), handler).subscribe({
      error: (error) => {
        expect(error).toBe(enotfound);
        expect(handleMock).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });
});
