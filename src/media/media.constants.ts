export const IMAGE_PROCESSING_QUEUE = 'image-processing';

export interface ImageProcessJobPayload {
  /** Исходный файл в base64 (до 5 МБ). */
  bufferBase64: string;
  /** Префикс ключа без расширения, например menu/{restaurantId}/{uuid}. */
  keyPrefix: string;
  /** Исходный MIME (jpeg/png/webp). */
  mimeType: string;
}

export interface ImageProcessJobResult {
  fallbackUrl: string;
  webpUrl: string;
  fallbackKey: string;
  webpKey: string;
}
