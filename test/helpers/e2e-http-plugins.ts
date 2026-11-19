import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { CorsOriginService } from '../../src/common/cors/cors-origin.service';

/** Mirrors production HTTP plugins from `src/main.ts` for security e2e. */
export async function registerProductionHttpPlugins(
  app: NestFastifyApplication,
): Promise<void> {
  const corsOriginService = app.get(CorsOriginService);

  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cors, {
    origin: (origin, callback) =>
      corsOriginService.validateOrigin(origin, callback),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Id'],
  });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}
