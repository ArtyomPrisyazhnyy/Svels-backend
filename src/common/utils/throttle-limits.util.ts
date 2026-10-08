/** В non-production лимиты выше — иначе Playwright/e2e упираются в 429. */
const isProd = process.env.NODE_ENV === 'production';

export const ThrottleLimits = {
  authRegister: { default: { limit: isProd ? 5 : 200, ttl: 60_000 } },
  authLogin: { default: { limit: isProd ? 10 : 200, ttl: 60_000 } },
  authGoogle: { default: { limit: isProd ? 10 : 200, ttl: 60_000 } },
  otpSend: { default: { limit: isProd ? 5 : 200, ttl: 60_000 } },
  otpVerify: { default: { limit: isProd ? 10 : 200, ttl: 60_000 } },
  otpRegister: { default: { limit: isProd ? 5 : 200, ttl: 60_000 } },
} as const;
