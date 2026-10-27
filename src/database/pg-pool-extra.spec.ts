import { resolvePgPoolExtra } from './pg-pool-extra';

describe('resolvePgPoolExtra', () => {
  const original = process.env.DB_CONNECTION_TIMEOUT_MS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DB_CONNECTION_TIMEOUT_MS;
    } else {
      process.env.DB_CONNECTION_TIMEOUT_MS = original;
    }
  });

  it('defaults connectionTimeoutMillis to 5000 and enables keepAlive', () => {
    delete process.env.DB_CONNECTION_TIMEOUT_MS;
    expect(resolvePgPoolExtra()).toEqual({
      connectionTimeoutMillis: 5_000,
      keepAlive: true,
    });
  });

  it('reads DB_CONNECTION_TIMEOUT_MS from env', () => {
    process.env.DB_CONNECTION_TIMEOUT_MS = '3000';
    expect(resolvePgPoolExtra().connectionTimeoutMillis).toBe(3_000);
  });
});
