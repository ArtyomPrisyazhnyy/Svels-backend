import { OtpRateLimitService } from './otp-rate-limit.service';
import { CacheService } from '../cache/cache.service';

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
