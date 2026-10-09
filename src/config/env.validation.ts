import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsOptional, IsString, validateSync } from 'class-validator';

const DEFAULT_JWT_SECRET = 'change-me-in-production';
const DEFAULT_REVALIDATE_SECRET = 'dev-revalidate-secret';
const DEFAULT_OTP_PEPPER = 'otp-dev-pepper';
const MIN_SECRET_LENGTH = 32;

const PRODUCTION_INSECURE_VALUES: Record<string, readonly string[]> = {
  JWT_SECRET: [DEFAULT_JWT_SECRET],
  REVALIDATE_SECRET: [DEFAULT_REVALIDATE_SECRET],
  OTP_PEPPER: [DEFAULT_OTP_PEPPER],
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

function assertProductionSecrets(env: EnvironmentVariables): void {
  const nodeEnv = env.NODE_ENV ?? NodeEnvironment.Development;
  if (nodeEnv !== NodeEnvironment.Production) {
    return;
  }

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
