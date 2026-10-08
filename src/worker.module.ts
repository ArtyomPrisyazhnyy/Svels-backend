import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import redisConfig from './config/redis.config';
import storageConfig from './config/storage.config';
import { MediaModule } from './media/media.module';
import { StorageModule } from './storage/storage.module';

/**
 * Минимальный контекст для image worker — без HTTP и бизнес-модулей.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, redisConfig, storageConfig],
    }),
    StorageModule,
    MediaModule.forRoot({ registerProcessor: true }),
  ],
})
export class WorkerModule {}
