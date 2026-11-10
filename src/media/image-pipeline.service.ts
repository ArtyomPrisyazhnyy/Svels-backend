import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { ImageConversionService } from './image-conversion.service';
import type { ImageProcessJobResult } from './media.constants';
import {
  RESPONSIVE_IMAGE_SIZES,
  responsiveVariantObjectKey,
  type PublicImageVariants,
} from './responsive-image-variants';

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
    responsiveVariants?: boolean;
  }): Promise<ImageProcessJobResult> {
    const cover = await this.conversionService.convert(
      params.buffer,
      params.mimeType,
    );
    const responsive = params.responsiveVariants
      ? await this.conversionService.buildResponsiveVariants(params.buffer)
      : null;

    const fallbackKey = `${params.keyPrefix}${cover.fallbackExtension}`;
    const webpKey = `${params.keyPrefix}.webp`;

    const [fallback, webp] = await Promise.all([
      this.storageService.putObject({
        key: fallbackKey,
        body: cover.fallbackBuffer,
        contentType: cover.fallbackContentType,
      }),
      this.storageService.putObject({
        key: webpKey,
        body: cover.webpBuffer,
        contentType: 'image/webp',
      }),
    ]);

    const imageVariants: PublicImageVariants | null = responsive ? {} : null;

    if (responsive) {
      await Promise.all(
        RESPONSIVE_IMAGE_SIZES.map(async (size) => {
          const file = responsive[size];
          if (!file || !imageVariants) {
            return;
          }
          const [jpg, webpVariant] = await Promise.all([
            this.storageService.putObject({
              key: responsiveVariantObjectKey(params.keyPrefix, size, 'jpg'),
              body: file.jpgBuffer,
              contentType: 'image/jpeg',
            }),
            this.storageService.putObject({
              key: responsiveVariantObjectKey(params.keyPrefix, size, 'webp'),
              body: file.webpBuffer,
              contentType: 'image/webp',
            }),
          ]);
          imageVariants[size] = {
            width: file.width,
            jpg: jpg.url,
            webp: webpVariant.url,
          };
        }),
      );
    }

    return {
      fallbackUrl: fallback.url,
      webpUrl: webp.url,
      fallbackKey: fallback.key,
      webpKey: webp.key,
      imageVariants,
    };
  }
}
