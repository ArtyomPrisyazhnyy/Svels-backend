import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsOptional, IsString, validateSync } from 'class-validator';

const DEFAULT_JWT_SECRET = 'change-me-in-production';

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
}

function assertProductionSecrets(env: EnvironmentVariables): void {
  const nodeEnv = env.NODE_ENV ?? NodeEnvironment.Development;
  if (nodeEnv !== NodeEnvironment.Production) {
    return;
  }

  const jwtSecret = env.JWT_SECRET?.trim() ?? '';
  if (!jwtSecret || jwtSecret === DEFAULT_JWT_SECRET) {
    throw new Error(
      'JWT_SECRET must be set to a non-default value in production',
    );
  }

  if (!env.BEPAY_CREDENTIALS_ENCRYPTION_KEY?.trim()) {
    throw new Error(
      'BEPAY_CREDENTIALS_ENCRYPTION_KEY is required in production',
    );
  }

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
