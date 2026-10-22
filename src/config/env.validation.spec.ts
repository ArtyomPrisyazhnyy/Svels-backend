import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const productionSecret = 'a'.repeat(32);
  const productionBase = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@host.example/db?sslmode=require',
    JWT_SECRET: productionSecret,
    BEPAY_CREDENTIALS_ENCRYPTION_KEY: productionSecret,
    REVALIDATE_SECRET: productionSecret,
    API_PUBLIC_URL: 'https://api.example.com',
    NEXT_SITE_URL: 'https://example.com',
    CORS_ALLOWED_ORIGINS: 'https://app.example.com,https://admin.example.com',
    GOOGLE_OAUTH_CLIENT_ID: 'google-oauth-client-id',
    TELEGRAM_BOT_TOKEN: 'telegram-bot-token',
    TELEGRAM_BOT_USERNAME: 'svels_bot',
    TELEGRAM_WEBHOOK_SECRET: productionSecret,
    REDIS_PASSWORD: productionSecret,
    THROTTLER_STORAGE: 'redis',
    STORAGE_DRIVER: 's3',
    S3_ENDPOINT: 'https://s3.hoster.by',
    S3_BUCKET: 'svels-media',
    S3_ACCESS_KEY_ID: 'access-key',
    S3_SECRET_ACCESS_KEY: 'secret-key',
    S3_PUBLIC_BASE_URL: 'https://img.example.com',
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

  it('fails in production without DATABASE_URL or DB_HOST', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        DATABASE_URL: '',
        DB_HOST: '',
      }),
    ).toThrow(/DB_HOST is required in production/);
  });

  it('fails in production without CORS_ALLOWED_ORIGINS', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        CORS_ALLOWED_ORIGINS: '',
      }),
    ).toThrow(/CORS_ALLOWED_ORIGINS is required in production/);
  });

  it('fails in production with non-https CORS origins', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        CORS_ALLOWED_ORIGINS: 'http://app.example.com',
      }),
    ).toThrow(/CORS_ALLOWED_ORIGINS must use https:\/\/ origins in production/);
  });

  it('fails in production without GOOGLE_OAUTH_CLIENT_ID', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        GOOGLE_OAUTH_CLIENT_ID: '',
      }),
    ).toThrow(/GOOGLE_OAUTH_CLIENT_ID is required in production/);
  });

  it('fails in production without telegram bot settings', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        TELEGRAM_BOT_TOKEN: '',
      }),
    ).toThrow(/TELEGRAM_BOT_TOKEN is required in production/);
  });

  it('fails in production when storage driver is yandex', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        STORAGE_DRIVER: 'yandex',
      }),
    ).toThrow(/STORAGE_DRIVER=yandex is no longer supported/);
  });

  it('fails in production when storage is not s3', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        STORAGE_DRIVER: 'local',
      }),
    ).toThrow(/STORAGE_DRIVER must be s3 in production/);
  });

  it('fails in production when S3 endpoint is not https', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        S3_ENDPOINT: 'http://s3.hoster.by',
      }),
    ).toThrow(/S3_ENDPOINT must use https:\/\//);
  });

  it('passes in production with required secrets', () => {
    expect(() => validateEnv(productionBase)).not.toThrow();
  });

  it('passes in production with DB_HOST instead of DATABASE_URL', () => {
    expect(() =>
      validateEnv({
        ...productionBase,
        DATABASE_URL: '',
        DB_HOST: 'postgres',
        DB_PASSWORD: productionSecret,
      }),
    ).not.toThrow();
  });
});
