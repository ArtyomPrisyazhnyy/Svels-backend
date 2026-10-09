import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module';

export async function createE2eApp(
  configureModule?: (
    builder: ReturnType<typeof Test.createTestingModule>,
  ) => void,
): Promise<NestFastifyApplication> {
  const builder = Test.createTestingModule({
    imports: [AppModule],
  });
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
