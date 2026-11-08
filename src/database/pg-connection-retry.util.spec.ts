import {
  isPgTransientConnectionError,
  withIdempotentReadRetry,
} from './pg-connection-retry.util';

describe('pg-connection-retry.util', () => {
  describe('isPgTransientConnectionError', () => {
    it('detects ENOTFOUND', () => {
      expect(isPgTransientConnectionError({ code: 'ENOTFOUND' })).toBe(true);
    });

    it('detects ECONNRESET', () => {
      expect(isPgTransientConnectionError({ code: 'ECONNRESET' })).toBe(true);
    });

    it('detects pool connection timeout message', () => {
      expect(
        isPgTransientConnectionError({
          message: 'Connection terminated due to connection timeout',
        }),
      ).toBe(true);
    });

    it('ignores unrelated errors', () => {
      expect(isPgTransientConnectionError(new Error('unique violation'))).toBe(
        false,
      );
    });
  });

  describe('withIdempotentReadRetry', () => {
    it('retries once after transient failure', async () => {
      const enotfound = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
        code: 'ENOTFOUND',
      });
      const operation = jest
        .fn()
        .mockRejectedValueOnce(enotfound)
        .mockResolvedValueOnce('ok');

      await expect(withIdempotentReadRetry(operation)).resolves.toBe('ok');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('does not retry non-transient errors', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('syntax error'));

      await expect(withIdempotentReadRetry(operation)).rejects.toThrow(
        'syntax error',
      );
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
