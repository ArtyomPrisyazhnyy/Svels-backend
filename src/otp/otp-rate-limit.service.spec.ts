import { OtpRateLimitService } from './otp-rate-limit.service';
import { CacheService } from '../cache/cache.service';

const MEMORY_MAX_KEYS = 10_000;
const HOUR_SECONDS = 3600;

interface MemoryCounterEntry {
  count: number;
  expiresAtMs: number;
  createdAtMs: number;
}

interface OtpRateLimitInternals {
  memory: Map<string, MemoryCounterEntry>;
  incrementMemory: (key: string, ttlSeconds: number) => void;
  maybeSweepMemory: () => void;
  lastMemorySweepAtMs: number;
}

function getInternals(service: OtpRateLimitService): OtpRateLimitInternals {
  return service as unknown as OtpRateLimitInternals;
}

describe('OtpRateLimitService', () => {
  let cache: {
    isAvailable: jest.Mock;
    getCounter: jest.Mock;
    incrementCounter: jest.Mock;
  };
  let service: OtpRateLimitService;

  beforeEach(() => {
    cache = {
      isAvailable: jest.fn().mockReturnValue(true),
      getCounter: jest.fn().mockResolvedValue(0),
      incrementCounter: jest.fn().mockResolvedValue(1),
    };
    service = new OtpRateLimitService(cache as unknown as CacheService);
  });

  it('blocks when phone minute limit reached', async () => {
    cache.getCounter.mockImplementation((key: string) =>
      Promise.resolve(key.includes('60s') ? 1 : 0),
    );

    await expect(
      service.assertCanSendOtp('375291234567', '127.0.0.1'),
    ).rejects.toMatchObject({
      response: { code: 'OTP_RATE_LIMITED', statusCode: 429 },
    });
  });

  it('records send counters in redis', async () => {
    await service.recordOtpSent('375291234567', '127.0.0.1');

    expect(cache.incrementCounter).toHaveBeenCalledTimes(3);
    expect(cache.incrementCounter).toHaveBeenCalledWith(
      'otp:rate:phone:60s:375291234567',
      60,
    );
  });

  it('purges expired in-memory entries when sweep runs', () => {
    cache.isAvailable.mockReturnValue(false);
    const local = new OtpRateLimitService(cache as unknown as CacheService);
    const internals = getInternals(local);
    const now = 5_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);

    internals.memory.set('expired', {
      count: 2,
      expiresAtMs: now - 1,
      createdAtMs: now - 10_000,
    });
    internals.lastMemorySweepAtMs = 0;
    internals.maybeSweepMemory();

    expect(internals.memory.size).toBe(0);
    jest.restoreAllMocks();
  });

  it('does not grow in-memory map beyond the hard cap', () => {
    cache.isAvailable.mockReturnValue(false);
    const local = new OtpRateLimitService(cache as unknown as CacheService);
    const internals = getInternals(local);
    const now = Date.now();
    internals.lastMemorySweepAtMs = now;

    for (let index = 0; index < MEMORY_MAX_KEYS + 50; index += 1) {
      internals.incrementMemory(`otp:rate:test:${index}`, HOUR_SECONDS);
    }

    expect(internals.memory.size).toBeLessThanOrEqual(MEMORY_MAX_KEYS);
  });

  it('uses in-memory counters when redis is unavailable', async () => {
    cache.isAvailable.mockReturnValue(false);
    const local = new OtpRateLimitService(cache as unknown as CacheService);

    await local.recordOtpSent('375291234567', '10.0.0.1');
    await expect(
      local.assertCanSendOtp('375291234567', '10.0.0.1'),
    ).rejects.toMatchObject({
      response: { code: 'OTP_RATE_LIMITED' },
    });
  });
});
