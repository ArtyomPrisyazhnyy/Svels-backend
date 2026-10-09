import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const productionSecret = 'a'.repeat(32);
  const productionBase = {
    NODE_ENV: 'production',
    JWT_SECRET: productionSecret,
    BEPAY_CREDENTIALS_ENCRYPTION_KEY: productionSecret,
    REVALIDATE_SECRET: productionSecret,
    API_PUBLIC_URL: 'https://api.example.com',
    NEXT_SITE_URL: 'https://example.com',
  };

  it('passes in development with defaults', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        JWT_SECRET: 'change-me-in-production',
      }),
    ).not.toThrow();
  });

  it('fails in production with default JWT_SECRET', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        JWT_SECRET: 'change-me-in-production',
      }),
    ).toThrow(
      /JWT_SECRET must not use the default or example value in production/,
    );
  });

  it('fails in production with short JWT_SECRET', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        JWT_SECRET: 'short',
      }),
    ).toThrow(/JWT_SECRET must be at least 32 characters in production/);
  });

  it('fails in production with empty JWT_SECRET', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        JWT_SECRET: '   ',
      }),
    ).toThrow(/JWT_SECRET must be at least 32 characters in production/);
  });

  it('fails in production without BEPAY_CREDENTIALS_ENCRYPTION_KEY', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        BEPAY_CREDENTIALS_ENCRYPTION_KEY: '',
      }),
    ).toThrow(
      /BEPAY_CREDENTIALS_ENCRYPTION_KEY must be at least 32 characters in production/,
    );
  });

  it('fails in production with default REVALIDATE_SECRET', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        REVALIDATE_SECRET: 'dev-revalidate-secret',
      }),
    ).toThrow(
      /REVALIDATE_SECRET must not use the default or example value in production/,
    );
  });

  it('fails in production with default OTP_PEPPER', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        OTP_PEPPER: 'otp-dev-pepper',
      }),
    ).toThrow(
      /OTP_PEPPER must not use the default or example value in production/,
    );
  });

  it('fails in production without API_PUBLIC_URL', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        API_PUBLIC_URL: '',
      }),
    ).toThrow(/API_PUBLIC_URL is required in production/);
  });

  it('fails in production without NEXT_SITE_URL', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        NEXT_SITE_URL: '',
      }),
    ).toThrow(/NEXT_SITE_URL is required in production/);
  });

  it('passes in production with required secrets', () => {
    expect(() => validateEnv(productionBase)).not.toThrow();
  });
});
