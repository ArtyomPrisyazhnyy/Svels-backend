import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents } from 'bullmq';
import { generateUuidV7 } from '../common/utils/uuid.util';
import { ImagePipelineService } from './image-pipeline.service';
import {
  IMAGE_PROCESSING_QUEUE,
  type ImageProcessJobPayload,
  type ImageProcessJobResult,
} from './media.constants';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface UploadedImageUrls {
  url: string;
  webpUrl: string;
}

@Injectable()
export class MediaUploadService {
  private readonly logger = new Logger(MediaUploadService.name);
  private queueEvents: QueueEvents | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly pipelineService: ImagePipelineService,
    @Optional()
    @InjectQueue(IMAGE_PROCESSING_QUEUE)
    private readonly imageQueue: Queue<
      ImageProcessJobPayload,
      ImageProcessJobResult
    > | null,
  ) {}

  async uploadMenuImage(
    restaurantId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<UploadedImageUrls> {
    return this.upload(buffer, mimeType, `menu/${restaurantId}`);
  }

  async uploadLogo(
    restaurantId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<UploadedImageUrls> {
    return this.upload(buffer, mimeType, `restaurants/${restaurantId}/logo`);
  }

  async uploadBanner(
    restaurantId: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<UploadedImageUrls> {
    return this.upload(buffer, mimeType, `restaurants/${restaurantId}/banners`);
  }

  validateImageBuffer(buffer: Buffer, mimeType: string): void {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Допустимы только JPG, PNG и WebP');
    }
    if (buffer.length > MAX_FILE_BYTES) {
      throw new BadRequestException('Размер файла не должен превышать 5 МБ');
    }
  }

  private async upload(
    buffer: Buffer,
    mimeType: string,
    folder: string,
  ): Promise<UploadedImageUrls> {
    this.validateImageBuffer(buffer, mimeType);

    const keyPrefix = `${folder}/${generateUuidV7()}`;
    const workerInline = this.configService.get<boolean>(
      'storage.image.workerInline',
      true,
    );

    // Inline (dev / один процесс): конвертация здесь.
    // Prod: IMAGE_WORKER_INLINE=false → очередь + отдельный `npm run start:worker`.
    if (workerInline || !this.imageQueue) {
      if (!workerInline && !this.imageQueue) {
        this.logger.warn(
          'Очередь изображений недоступна — выполняю конвертацию в API-процессе',
        );
      }
      const result = await this.pipelineService.processAndStore({
        buffer,
        keyPrefix,
        mimeType,
      });
      return { url: result.fallbackUrl, webpUrl: result.webpUrl };
    }

    return this.enqueueAndWait({ buffer, keyPrefix, mimeType });
  }

  private async enqueueAndWait(params: {
    buffer: Buffer;
    keyPrefix: string;
    mimeType: string;
  }): Promise<UploadedImageUrls> {
    if (!this.imageQueue) {
      throw new ServiceUnavailableException('Очередь обработки изображений недоступна');
    }

    const timeoutMs = this.configService.get<number>('storage.image.jobTimeoutMs', 60_000);
    const job = await this.imageQueue.add(
      'process',
      {
        bufferBase64: params.buffer.toString('base64'),
        keyPrefix: params.keyPrefix,
        mimeType: params.mimeType,
      },
      {
        attempts: 2,
        removeOnComplete: 100,
        removeOnFail: 50,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    try {
      const events = this.getQueueEvents();
      const result = await job.waitUntilFinished(events, timeoutMs);
      return { url: result.fallbackUrl, webpUrl: result.webpUrl };
    } catch (error) {
      this.logger.error(
        `Image job ${job.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'Не удалось обработать изображение. Убедитесь, что запущен image worker (npm run start:worker).',
      );
    }
  }

  private getQueueEvents(): QueueEvents {
    if (!this.queueEvents) {
      this.queueEvents = new QueueEvents(IMAGE_PROCESSING_QUEUE, {
        connection: {
          host: this.configService.get<string>('redis.host', 'localhost'),
          port: this.configService.get<number>('redis.port', 6379),
          password: this.configService.get<string>('redis.password') || undefined,
        },
      });
    }
    return this.queueEvents;
  }
}
