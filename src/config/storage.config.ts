export default () => ({
  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 'yandex',
    yandex: {
      bucket: process.env.YANDEX_STORAGE_BUCKET ?? '',
      accessKeyId: process.env.YANDEX_STORAGE_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.YANDEX_STORAGE_SECRET_ACCESS_KEY ?? '',
      region: process.env.YANDEX_STORAGE_REGION ?? 'ru-central1',
      endpoint:
        process.env.YANDEX_STORAGE_ENDPOINT ??
        'https://storage.yandexcloud.net',
      /**
       * Публичный базовый URL без завершающего слэша.
       * Пример: https://storage.yandexcloud.net/my-bucket
       * или https://my-bucket.storage.yandexcloud.net
       */
      publicBaseUrl:
        process.env.YANDEX_STORAGE_PUBLIC_BASE_URL ??
        (process.env.YANDEX_STORAGE_BUCKET
          ? `https://storage.yandexcloud.net/${process.env.YANDEX_STORAGE_BUCKET}`
          : ''),
    },
    image: {
      maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH ?? '1600', 10),
      jpegQuality: parseInt(process.env.IMAGE_JPEG_QUALITY ?? '82', 10),
      webpQuality: parseInt(process.env.IMAGE_WEBP_QUALITY ?? '80', 10),
      /**
       * true — processor крутится в том же процессе, что и API (удобно для dev).
       * false — только enqueue; нужен отдельный `npm run start:worker`.
       */
      workerInline: process.env.IMAGE_WORKER_INLINE !== 'false',
      jobTimeoutMs: parseInt(process.env.IMAGE_JOB_TIMEOUT_MS ?? '60000', 10),
    },
  },
});
