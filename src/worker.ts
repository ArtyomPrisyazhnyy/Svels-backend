import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

/**
 * Отдельный процесс для CPU-heavy конвертации изображений (sharp + загрузка в storage).
 * Запуск: npm run start:worker
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });

  const logger = new Logger('ImageWorker');
  logger.log('Image worker started (BullMQ + sharp)');

  const shutdown = async (signal: string) => {
    logger.log(`Shutting down on ${signal}`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
