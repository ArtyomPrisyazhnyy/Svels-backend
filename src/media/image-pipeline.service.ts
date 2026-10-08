import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { ImageConversionService } from './image-conversion.service';
import type { ImageProcessJobResult } from './media.constants';

@Injectable()
export class ImagePipelineService {
  constructor(
    private readonly conversionService: ImageConversionService,
    private readonly storageService: StorageService,
  ) {}

  async processAndStore(params: {
    buffer: Buffer;
    keyPrefix: string;
    mimeType: string;
  }): Promise<ImageProcessJobResult> {
    const variants = await this.conversionService.convert(params.buffer, params.mimeType);

    const fallbackKey = `${params.keyPrefix}${variants.fallbackExtension}`;
    const webpKey = `${params.keyPrefix}.webp`;

    const [fallback, webp] = await Promise.all([
      this.storageService.putObject({
        key: fallbackKey,
        body: variants.fallbackBuffer,
        contentType: variants.fallbackContentType,
      }),
      this.storageService.putObject({
        key: webpKey,
        body: variants.webpBuffer,
        contentType: 'image/webp',
      }),
    ]);

    return {
      fallbackUrl: fallback.url,
      webpUrl: webp.url,
      fallbackKey: fallback.key,
      webpKey: webp.key,
    };
  }
}
