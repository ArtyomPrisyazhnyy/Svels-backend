import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

export interface ConvertedImageVariants {
  fallbackBuffer: Buffer;
  fallbackContentType: 'image/jpeg' | 'image/png';
  fallbackExtension: '.jpg' | '.png';
  webpBuffer: Buffer;
}

@Injectable()
export class ImageConversionService {
  private readonly maxWidth: number;
  private readonly jpegQuality: number;
  private readonly webpQuality: number;

  constructor(private readonly configService: ConfigService) {
    this.maxWidth = this.configService.get<number>(
      'storage.image.maxWidth',
      1600,
    );
    this.jpegQuality = this.configService.get<number>(
      'storage.image.jpegQuality',
      82,
    );
    this.webpQuality = this.configService.get<number>(
      'storage.image.webpQuality',
      80,
    );
  }

  /**
   * Готовит WebP + fallback (JPEG, либо PNG если нужна прозрачность).
   * CPU-heavy — вызывать только из image worker / очереди.
   */
  async convert(
    buffer: Buffer,
    mimeType: string,
  ): Promise<ConvertedImageVariants> {
    const image = sharp(buffer, { failOn: 'none' }).rotate();
    const metadata = await image.metadata();

    const pipeline =
      metadata.width && metadata.width > this.maxWidth
        ? image.resize({
            width: this.maxWidth,
            withoutEnlargement: true,
          })
        : image;

    const hasAlpha = Boolean(metadata.hasAlpha);
    const preferPng = hasAlpha || mimeType === 'image/png';

    const [fallbackBuffer, webpBuffer] = await Promise.all([
      preferPng
        ? pipeline.clone().png({ compressionLevel: 8 }).toBuffer()
        : pipeline
            .clone()
            .jpeg({ quality: this.jpegQuality, mozjpeg: true })
            .toBuffer(),
      pipeline.clone().webp({ quality: this.webpQuality }).toBuffer(),
    ]);

    return {
      fallbackBuffer,
      fallbackContentType: preferPng ? 'image/png' : 'image/jpeg',
      fallbackExtension: preferPng ? '.png' : '.jpg',
      webpBuffer,
    };
  }
}
