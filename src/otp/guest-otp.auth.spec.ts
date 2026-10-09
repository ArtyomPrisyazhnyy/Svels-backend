import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import type { IUsersService } from '../users/interfaces/users-service.interface';
import type { ITelegramOtpProvider } from './interfaces/telegram-otp-provider.interface';
import { OtpStoreService } from './otp-store.service';
import { SmsRouterService } from './providers/sms-router.service';
import { GoogleTokenService } from '../auth/google-token.service';
import { UserRole } from '../common/enums/user-role.enum';
import { AuthProvider } from '../common/enums/auth-provider.enum';

describe('AuthService guest OTP', () => {
  const restaurantId = '019efb61-5000-7000-8000-000000000001';
  const phone = '375291234567';

  let authService: AuthService;
  let usersService: jest.Mocked<
    Pick<
      IUsersService,
      'findGuestByPhoneAndRestaurant' | 'findById' | 'createGuest'
    >
  >;
  let otpStore: jest.Mocked<
    Pick<
      OtpStoreService,
      | 'get'
      | 'save'
      | 'delete'
      | 'assertCanResend'
      | 'generateCode'
      | 'createRecord'
      | 'verifyCode'
      | 'getTtlSeconds'
      | 'getResendSeconds'
    >
  >;
  let telegram: jest.Mocked<ITelegramOtpProvider>;
  let smsRouter: jest.Mocked<Pick<SmsRouterService, 'sendOtp'>>;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let otpRateLimit: {
    assertCanSendOtp: jest.Mock;
    recordOtpSent: jest.Mock;
  };

  beforeEach(() => {
    usersService = {
      findGuestByPhoneAndRestaurant: jest.fn(),
      findById: jest.fn(),
      createGuest: jest.fn(),
    };

    otpStore = {
      get: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      assertCanResend: jest.fn(),
      generateCode: jest.fn().mockReturnValue('123456'),
      createRecord: jest.fn().mockImplementation((params) => ({
        codeHash: 'hash',
        phone: params.phone,
        restaurantId: params.restaurantId,
        channel: params.channel,
        createdAt: new Date().toISOString(),
        resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        verifyAttempts: 0,
        sendCount: params.sendCount,
        country: params.country,
        telegramRequestId: params.telegramRequestId,
      })),
      verifyCode: jest.fn(),
      getTtlSeconds: jest.fn().mockReturnValue(300),
      getResendSeconds: jest.fn().mockReturnValue(60),
    };

    telegram = {
      sendCode: jest.fn(),
      waitForDelivery: jest.fn(),
      reportCodeChecked: jest.fn().mockResolvedValue(undefined),
    };

    smsRouter = {
      sendOtp: jest.fn().mockResolvedValue({ ok: true, provider: 'sms_by' }),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
      verify: jest.fn(),
    };

    otpRateLimit = {
      assertCanSendOtp: jest.fn().mockResolvedValue(undefined),
      recordOtpSent: jest.fn().mockResolvedValue(undefined),
    };

    const config = {
      get: (key: string, fallback?: unknown) => {
        if (key === 'otp.telegramWaitMs') {
          return 50;
        }
        return fallback;
      },
    } as unknown as ConfigService;

    authService = new AuthService(
      usersService as unknown as IUsersService,
      jwtService as unknown as JwtService,
      { emit: jest.fn() } as unknown as EventEmitter2,
      {} as GoogleTokenService,
      otpStore as unknown as OtpStoreService,
      telegram,
      smsRouter as unknown as SmsRouterService,
      config,
      {
        findValidTokenRecord: jest.fn(),
        assertTokenUsable: jest.fn(),
        claimToken: jest.fn(),
      } as never,
      otpRateLimit as never,
    );
  });

  it('sends via telegram when delivery succeeds', async () => {
    telegram.sendCode.mockResolvedValue({ ok: true, requestId: 'req-1' });
    telegram.waitForDelivery.mockResolvedValue({
      delivered: true,
      status: 'delivered',
    });

    const result = await authService.sendGuestOtp(
      restaurantId,
      {
        phone: '+375291234567',
      },
      '127.0.0.1',
    );

    expect(result.channel).toBe('telegram');
    expect(smsRouter.sendOtp).not.toHaveBeenCalled();
    expect(otpStore.save).toHaveBeenCalled();
  });

  it('falls back to SMS when telegram fails', async () => {
    telegram.sendCode.mockResolvedValue({
      ok: false,
      unavailable: true,
      error: 'NO_TG',
    });

    const result = await authService.sendGuestOtp(
      restaurantId,
      {
        phone: '+375291234567',
      },
      '127.0.0.1',
    );

    expect(result.channel).toBe('sms');
    expect(smsRouter.sendOtp).toHaveBeenCalledWith(phone, '123456');
  });

  it('resend skips telegram and goes SMS only', async () => {
    otpStore.get.mockResolvedValue({
      codeHash: 'x',
      phone,
      restaurantId,
      channel: 'telegram',
      createdAt: new Date().toISOString(),
      resendAvailableAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      verifyAttempts: 0,
      sendCount: 1,
      country: 'BY',
    });

    const result = await authService.resendGuestOtp(
      restaurantId,
      {
        phone: '+375291234567',
      },
      '127.0.0.1',
    );

    expect(telegram.sendCode).not.toHaveBeenCalled();
    expect(smsRouter.sendOtp).toHaveBeenCalled();
    expect(result.channel).toBe('sms');
  });

  it('throws when SMS fails after telegram miss', async () => {
    telegram.sendCode.mockResolvedValue({ ok: false, error: 'fail' });
    smsRouter.sendOtp.mockResolvedValue({
      ok: false,
      provider: 'sms_by',
      error: 'down',
    });

    await expect(
      authService.sendGuestOtp(
        restaurantId,
        { phone: '+375291234567' },
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns registration_required for new guest', async () => {
    otpStore.verifyCode.mockResolvedValue({
      codeHash: 'x',
      phone,
      restaurantId,
      channel: 'sms',
      createdAt: new Date().toISOString(),
      resendAvailableAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      verifyAttempts: 0,
      sendCount: 1,
      country: 'BY',
    });
    usersService.findGuestByPhoneAndRestaurant.mockResolvedValue(null);

    const result = await authService.verifyGuestOtp(restaurantId, {
      phone: '+375291234567',
      code: '123456',
    });

    expect(result.status).toBe('registration_required');
    if (result.status === 'registration_required') {
      expect(result.registrationToken).toBe('jwt-token');
    }
  });

  it('returns authenticated for existing guest', async () => {
    otpStore.verifyCode.mockResolvedValue({
      codeHash: 'x',
      phone,
      restaurantId,
      channel: 'sms',
      createdAt: new Date().toISOString(),
      resendAvailableAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      verifyAttempts: 0,
      sendCount: 1,
      country: 'BY',
    });
    usersService.findGuestByPhoneAndRestaurant.mockResolvedValue({
      id: 'u1',
      email: 'guest@local',
      phone,
      role: UserRole.USER,
      authProvider: AuthProvider.LOCAL,
      restaurantId,
    });
    usersService.findById.mockResolvedValue({
      id: 'u1',
      email: 'guest@local',
      phone,
      firstName: 'A',
      lastName: 'B',
      role: UserRole.USER,
      authProvider: AuthProvider.LOCAL,
      restaurantId,
      createdAt: new Date(),
    });

    const result = await authService.verifyGuestOtp(restaurantId, {
      phone: '+375291234567',
      code: '123456',
    });

    expect(result.status).toBe('authenticated');
    if (result.status === 'authenticated') {
      expect(result.accessToken).toBe('jwt-token');
      expect(result.user.id).toBe('u1');
    }
  });
});
