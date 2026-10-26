import { resolveAppS3Env, resolveStorageDriver } from './s3-env';

export default () => ({
  storage: {
    driver: resolveStorageDriver(),
    s3: resolveAppS3Env(),
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
