import { HttpException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpStoreService } from './otp-store.service';
import { CacheService } from '../cache/cache.service';

describe('OtpStoreService', () => {
  let store: OtpStoreService;
  let cache: {
    getRequired: jest.Mock;
    setRequired: jest.Mock;
    delRequired: jest.Mock;
  };

  beforeEach(() => {
    cache = {
      getRequired: jest.fn(),
      setRequired: jest.fn(),
      delRequired: jest.fn(),
    };

    const config = {
      get: (key: string, fallback?: unknown) => {
        const map: Record<string, unknown> = {
          'otp.ttlSeconds': 300,
          'otp.resendSeconds': 60,
          'otp.codeLength': 6,
          'otp.maxVerifyAttempts': 5,
          'otp.pepper': 'test-pepper',
        };
        return map[key] ?? fallback;
      },
    } as unknown as ConfigService;

    store = new OtpStoreService(cache as unknown as CacheService, config);
  });

  it('generates numeric code of configured length', () => {
    const code = store.generateCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('blocks resend before cooldown', () => {
    const record = store.createRecord({
      restaurantId: 'r1',
      phone: '375291234567',
      code: '123456',
      channel: 'sms',
      country: 'BY',
      sendCount: 1,
    });

    try {
      store.assertCanResend(record);
      throw new Error('expected assertCanResend to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'OTP_RATE_LIMITED',
      });
    }
  });

  it('verifies matching code and rejects wrong one', async () => {
    const record = store.createRecord({
      restaurantId: 'r1',
      phone: '375291234567',
      code: '654321',
      channel: 'telegram',
      country: 'BY',
      sendCount: 1,
    });
    cache.getRequired.mockResolvedValue(record);
    cache.setRequired.mockResolvedValue(undefined);

    await expect(
      store.verifyCode('r1', '375291234567', '000000'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cache.setRequired).toHaveBeenCalled();

    cache.getRequired.mockResolvedValue({ ...record, verifyAttempts: 1 });
    await expect(
      store.verifyCode('r1', '375291234567', '654321'),
    ).resolves.toMatchObject({
      phone: '375291234567',
      channel: 'telegram',
    });
  });
});
