function parseBooleanEnv(
  raw: string | undefined,
  defaultValue: boolean,
): boolean {
  if (raw === undefined || raw.trim() === '') {
    return defaultValue;
  }
  return raw === 'true' || raw === '1';
}

export default () => ({
  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      region: process.env.S3_REGION ?? 'us-east-1',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      forcePathStyle: parseBooleanEnv(process.env.S3_FORCE_PATH_STYLE, true),
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? '',
    },
    image: {
      maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH ?? '1600', 10),
      jpegQuality: parseInt(process.env.IMAGE_JPEG_QUALITY ?? '82', 10),
      webpQuality: parseInt(process.env.IMAGE_WEBP_QUALITY ?? '80', 10),
      workerInline: process.env.IMAGE_WORKER_INLINE !== 'false',
      jobTimeoutMs: parseInt(process.env.IMAGE_JOB_TIMEOUT_MS ?? '60000', 10),
    },
  },
});
