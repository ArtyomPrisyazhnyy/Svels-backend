import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  GUEST_APPLE_ID_TOKEN_VERIFIER,
  GUEST_APPLE_JWKS_RESOLVER,
  GUEST_GOOGLE_ID_TOKEN_VERIFIER,
} from '../../src/common/constants/injection-tokens';
import {
  E2eGuestAppleIdTokenVerifier,
  E2eGuestGoogleIdTokenVerifier,
} from './guest-oauth-test-verifiers';

function applyGuestOAuthE2eOverrides(
  builder: ReturnType<typeof Test.createTestingModule>,
): void {
  builder.overrideProvider(GUEST_APPLE_JWKS_RESOLVER).useValue(() => {
    throw new Error('Apple JWKS must not be fetched in e2e tests');
  });
  builder.overrideProvider(GUEST_GOOGLE_ID_TOKEN_VERIFIER).useFactory({
    factory: (jwt: JwtService) => new E2eGuestGoogleIdTokenVerifier(jwt),
    inject: [JwtService],
  });
  builder.overrideProvider(GUEST_APPLE_ID_TOKEN_VERIFIER).useFactory({
    factory: (jwt: JwtService) => new E2eGuestAppleIdTokenVerifier(jwt),
    inject: [JwtService],
  });
}

export async function createE2eApp(
  configureModule?: (
    builder: ReturnType<typeof Test.createTestingModule>,
  ) => void,
): Promise<NestFastifyApplication> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
  });
  applyGuestOAuthE2eOverrides(builder);
  if (configureModule) {
    configureModule(builder);
  }
  const moduleFixture: TestingModule = await builder.compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export async function closeE2eApp(
  app: NestFastifyApplication | undefined,
): Promise<void> {
  if (!app) {
    return;
  }
  try {
    const dataSource = app.get(DataSource, { strict: false });
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  } catch {
    // DataSource may be unavailable if the module failed to boot.
  }
  await app.close();
}
