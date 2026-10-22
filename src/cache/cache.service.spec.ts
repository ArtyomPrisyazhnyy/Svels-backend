import { ConfigService } from '@nestjs/config';
import { CACHE_NULL_SENTINEL, CacheKeys } from './cache-keys';
import { CacheService } from './cache.service';

const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  pipeline: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  status: 'ready',
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => redisMock),
}));

function createService(overrides?: Record<string, unknown>): CacheService {
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const map: Record<string, unknown> = {
        'redis.ttl': 3600,
        'redis.enabled': true,
        'redis.host': '127.0.0.1',
        'redis.port': 6379,
        'redis.password': 'secret',
        ...overrides,
      };
      return map[key] ?? fallback;
    }),
  };
  return new CacheService(config as unknown as ConfigService);
}

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisMock.status = 'ready';
    redisMock.connect.mockResolvedValue(undefined);
  });

  it('get/set round-trip JSON values', async () => {
    const service = createService();
    await service.onModuleInit();
    redisMock.get.mockResolvedValue(JSON.stringify({ ok: true }));

    const value = await service.get<{ ok: boolean }>('key');
    expect(value).toEqual({ ok: true });

    await service.set('key', { ok: true }, 120);
    expect(redisMock.set).toHaveBeenCalledWith(
      'key',
      JSON.stringify({ ok: true }),
      'EX',
      120,
    );
  });

  it('distinguishes cache miss and negative sentinel', async () => {
    const service = createService();
    await service.onModuleInit();

    redisMock.get.mockResolvedValueOnce(null);
    await expect(service.getWithSentinel('k')).resolves.toEqual({
      status: 'miss',
    });

    redisMock.get.mockResolvedValueOnce(CACHE_NULL_SENTINEL);
    await expect(service.getWithSentinel('k')).resolves.toEqual({
      status: 'hit',
      value: null,
    });
  });

  it('stores null sentinel with TTL', async () => {
    const service = createService();
    await service.onModuleInit();

    await service.setNullSentinel('domain:missing', 60);
    expect(redisMock.set).toHaveBeenCalledWith(
      'domain:missing',
      CACHE_NULL_SENTINEL,
      'EX',
      60,
    );
  });

  it('deletes keys by SCAN pattern without KEYS', async () => {
    const service = createService();
    await service.onModuleInit();

    redisMock.scan
      .mockResolvedValueOnce(['5', ['a:1', 'a:2']])
      .mockResolvedValueOnce(['0', ['a:3']]);
    redisMock.del.mockResolvedValue(1);

    await service.delByPattern('a:*');

    expect(redisMock.scan).toHaveBeenCalledWith(
      '0',
      'MATCH',
      'a:*',
      'COUNT',
      100,
    );
    expect(redisMock.del).toHaveBeenCalledWith('a:1', 'a:2');
    expect(redisMock.del).toHaveBeenCalledWith('a:3');
  });

  it('returns null from get when Redis is disabled', async () => {
    const service = createService({ 'redis.enabled': false });
    await expect(service.get('k')).resolves.toBeNull();
    expect(redisMock.get).not.toHaveBeenCalled();
  });

  it('tryLock uses SET NX EX', async () => {
    const service = createService();
    await service.onModuleInit();
    redisMock.set.mockResolvedValueOnce('OK');

    const token = await service.tryLock('lock:key', 30);
    expect(token).toBeTruthy();
    expect(redisMock.set).toHaveBeenCalledWith(
      'lock:key',
      token,
      'EX',
      30,
      'NX',
    );
  });

  it('delMany batches deletes in a pipeline', async () => {
    const service = createService();
    await service.onModuleInit();
    const del = jest.fn();
    redisMock.pipeline.mockReturnValue({ del, exec: jest.fn() });

    await service.delMany([
      CacheKeys.menu('r1'),
      CacheKeys.schedules('r1'),
    ]);

    expect(del).toHaveBeenCalledTimes(2);
  });
});
