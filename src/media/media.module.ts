import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ImageConversionService } from './image-conversion.service';
import { ImagePipelineService } from './image-pipeline.service';
import { ImageProcessingProcessor } from './image-processing.processor';
import { MediaUploadService } from './media-upload.service';
import { IMAGE_PROCESSING_QUEUE } from './media.constants';

export interface MediaModuleOptions {
  /** Регистрировать BullMQ processor (только в worker-процессе или dual-mode). */
  registerProcessor?: boolean;
}

function isRedisEnabled(): boolean {
  return process.env.REDIS_ENABLED !== 'false';
}

@Module({})
export class MediaModule {
  static forRoot(options: MediaModuleOptions = {}): DynamicModule {
    const redisEnabled = isRedisEnabled();
    const registerProcessor = Boolean(options.registerProcessor);

    if (!redisEnabled) {
      return {
        module: MediaModule,
        global: true,
        providers: [
          ImageConversionService,
          ImagePipelineService,
          MediaUploadService,
          { provide: getQueueToken(IMAGE_PROCESSING_QUEUE), useValue: null },
        ],
        exports: [
          MediaUploadService,
          ImagePipelineService,
          ImageConversionService,
        ],
      };
    }

    return {
      module: MediaModule,
      global: true,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            connection: {
              host: configService.get<string>('redis.host', 'localhost'),
              port: configService.get<number>('redis.port', 6379),
              password:
                configService.get<string>('redis.password') || undefined,
              maxRetriesPerRequest: null,
            },
          }),
        }),
        BullModule.registerQueue({ name: IMAGE_PROCESSING_QUEUE }),
      ],
      providers: [
        ImageConversionService,
        ImagePipelineService,
        MediaUploadService,
        ...(registerProcessor ? [ImageProcessingProcessor] : []),
      ],
      exports: [
        MediaUploadService,
        ImagePipelineService,
        ImageConversionService,
      ],
    };
  }
}
