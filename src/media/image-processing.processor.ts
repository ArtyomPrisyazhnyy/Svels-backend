import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { ImagePipelineService } from './image-pipeline.service';
import {
  IMAGE_PROCESSING_QUEUE,
  type ImageProcessJobPayload,
  type ImageProcessJobResult,
} from './media.constants';

@Processor(IMAGE_PROCESSING_QUEUE, { concurrency: 1 })
export class ImageProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessingProcessor.name);

  constructor(private readonly pipelineService: ImagePipelineService) {
    super();
  }

  async process(job: Job<ImageProcessJobPayload>): Promise<ImageProcessJobResult> {
    this.logger.debug(`Processing image job ${job.id} → ${job.data.keyPrefix}`);
    const buffer = Buffer.from(job.data.bufferBase64, 'base64');
    return this.pipelineService.processAndStore({
      buffer,
      keyPrefix: job.data.keyPrefix,
      mimeType: job.data.mimeType,
    });
  }
}
