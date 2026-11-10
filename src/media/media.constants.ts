import type { PublicImageVariants } from './responsive-image-variants';

export const IMAGE_PROCESSING_QUEUE = 'image-processing';

export interface ImageProcessJobPayload {
  /** Исходный файл в base64 (до 5 МБ). */
  bufferBase64: string;
  /** Префикс ключа без расширения, например menu/{restaurantId}/{uuid}. */
  keyPrefix: string;
  /** Исходный MIME (jpeg/png/webp). */
  mimeType: string;
  /** Варианты sm/md/lg. Для логотипа и баннеров — false. */
  responsiveVariants?: boolean;
}

export interface ImageProcessJobResult {
  fallbackUrl: string;
  webpUrl: string;
  fallbackKey: string;
  webpKey: string;
  /** null — варианты не запрашивались. {} — запрошены, но исходник слишком узкий. */
  imageVariants: PublicImageVariants | null;
}
