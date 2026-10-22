import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsOptional, IsString, validateSync } from 'class-validator';

const DEFAULT_JWT_SECRET = 'change-me-in-production';
const DEFAULT_REVALIDATE_SECRET = 'dev-revalidate-secret';
const DEFAULT_OTP_PEPPER = 'otp-dev-pepper';
const DEFAULT_DB_PASSWORD = 'postgres';
const MIN_SECRET_LENGTH = 32;

const PRODUCTION_INSECURE_VALUES: Record<string, readonly string[]> = {
  JWT_SECRET: [DEFAULT_JWT_SECRET],
  REVALIDATE_SECRET: [DEFAULT_REVALIDATE_SECRET],
  OTP_PEPPER: [DEFAULT_OTP_PEPPER],
  DB_PASSWORD: [DEFAULT_DB_PASSWORD],
};

export enum NodeEnvironment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnvironment)
  NODE_ENV?: NodeEnvironment;

  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  DB_HOST?: string;

  @IsOptional()
  @IsString()
  DB_PASSWORD?: string;

  @IsOptional()
  @IsString()
  REDIS_ENABLED?: string;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsOptional()
  @IsString()
  THROTTLER_STORAGE?: string;

  @IsOptional()
  @IsString()
  STORAGE_DRIVER?: string;

  @IsOptional()
  @IsString()
  YANDEX_STORAGE_BUCKET?: string;

  @IsOptional()
  @IsString()
  YANDEX_STORAGE_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  YANDEX_STORAGE_SECRET_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  CORS_ALLOWED_ORIGINS?: string;

  @IsOptional()
  @IsString()
  GOOGLE_OAUTH_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  TELEGRAM_BOT_TOKEN?: string;

  @IsOptional()
  @IsString()
  TELEGRAM_BOT_USERNAME?: string;

  @IsOptional()
  @IsString()
  TELEGRAM_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  BEPAY_CREDENTIALS_ENCRYPTION_KEY?: string;

  @IsOptional()
  @IsString()
  API_PUBLIC_URL?: string;

  @IsOptional()
  @IsString()
  NEXT_SITE_URL?: string;

  @IsOptional()
  @IsString()
  REVALIDATE_SECRET?: string;

  @IsOptional()
  @IsString()
  OTP_PEPPER?: string;
}

function assertProductionSecret(
  name: string,
  rawValue: string | undefined,
  insecureDefaults: readonly string[],
): void {
  const value = rawValue?.trim() ?? '';
  if (!value) {
    throw new Error(
      `${name} must be at least ${MIN_SECRET_LENGTH} characters in production`,
    );
  }

  if (insecureDefaults.includes(value)) {
    throw new Error(
      `${name} must not use the default or example value in production`,
    );
  }

  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be at least ${MIN_SECRET_LENGTH} characters in production`,
    );
  }
}

function assertProductionNonEmpty(
  name: string,
  rawValue: string | undefined,
): void {
  if (!rawValue?.trim()) {
    throw new Error(`${name} is required in production`);
  }
}

function assertProductionDatabase(env: EnvironmentVariables): void {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl) {
    return;
  }

  assertProductionNonEmpty('DB_HOST', env.DB_HOST);
  assertProductionSecret(
    'DB_PASSWORD',
    env.DB_PASSWORD,
    PRODUCTION_INSECURE_VALUES.DB_PASSWORD,
  );
}

function assertProductionCors(env: EnvironmentVariables): void {
  const origins = env.CORS_ALLOWED_ORIGINS?.trim() ?? '';
  if (!origins) {
    throw new Error('CORS_ALLOWED_ORIGINS is required in production');
  }

  const entries = origins
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must list at least one origin');
  }

  const invalid = entries.filter((origin) => !origin.startsWith('https://'));
  if (invalid.length > 0) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS must use https:// origins in production',
    );
  }
}

function assertProductionRedis(env: EnvironmentVariables): void {
  if (env.REDIS_ENABLED === 'false') {
    return;
  }

  assertProductionSecret('REDIS_PASSWORD', env.REDIS_PASSWORD, []);

  if (env.THROTTLER_STORAGE?.trim() !== 'redis') {
    throw new Error('THROTTLER_STORAGE must be redis in production');
  }
}

function assertProductionStorage(env: EnvironmentVariables): void {
  const driver = env.STORAGE_DRIVER?.trim() ?? 'local';
  if (driver !== 'yandex') {
    throw new Error('STORAGE_DRIVER must be yandex in production');
  }

  assertProductionNonEmpty('YANDEX_STORAGE_BUCKET', env.YANDEX_STORAGE_BUCKET);
  assertProductionNonEmpty(
    'YANDEX_STORAGE_ACCESS_KEY_ID',
    env.YANDEX_STORAGE_ACCESS_KEY_ID,
  );
  assertProductionNonEmpty(
    'YANDEX_STORAGE_SECRET_ACCESS_KEY',
    env.YANDEX_STORAGE_SECRET_ACCESS_KEY,
  );
}

function assertProductionTelegram(env: EnvironmentVariables): void {
  assertProductionNonEmpty('TELEGRAM_BOT_TOKEN', env.TELEGRAM_BOT_TOKEN);
  assertProductionNonEmpty('TELEGRAM_BOT_USERNAME', env.TELEGRAM_BOT_USERNAME);
  assertProductionSecret(
    'TELEGRAM_WEBHOOK_SECRET',
    env.TELEGRAM_WEBHOOK_SECRET,
    [],
  );
}

function assertProductionSecrets(env: EnvironmentVariables): void {
  const nodeEnv = env.NODE_ENV ?? NodeEnvironment.Development;
  if (nodeEnv !== NodeEnvironment.Production) {
    return;
  }

  assertProductionDatabase(env);
  assertProductionCors(env);
  assertProductionRedis(env);
  assertProductionStorage(env);
  assertProductionTelegram(env);

  assertProductionNonEmpty(
    'GOOGLE_OAUTH_CLIENT_ID',
    env.GOOGLE_OAUTH_CLIENT_ID,
  );

  assertProductionSecret(
    'JWT_SECRET',
    env.JWT_SECRET,
    PRODUCTION_INSECURE_VALUES.JWT_SECRET,
  );

  assertProductionSecret(
    'BEPAY_CREDENTIALS_ENCRYPTION_KEY',
    env.BEPAY_CREDENTIALS_ENCRYPTION_KEY,
    [],
  );

  assertProductionSecret(
    'REVALIDATE_SECRET',
    env.REVALIDATE_SECRET,
    PRODUCTION_INSECURE_VALUES.REVALIDATE_SECRET,
  );

  const otpPepper =
    env.OTP_PEPPER?.trim() || env.JWT_SECRET?.trim() || DEFAULT_OTP_PEPPER;
  assertProductionSecret(
    'OTP_PEPPER',
    otpPepper,
    PRODUCTION_INSECURE_VALUES.OTP_PEPPER,
  );

  if (!env.API_PUBLIC_URL?.trim()) {
    throw new Error('API_PUBLIC_URL is required in production');
  }

  if (!env.NEXT_SITE_URL?.trim()) {
    throw new Error('NEXT_SITE_URL is required in production');
  }
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    const messages = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  assertProductionSecrets(validated);

  return config;
}
