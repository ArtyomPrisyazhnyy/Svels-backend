import {
  resolveAppS3Env,
  resolveStorageDriver,
  resolveSrcS3Env,
} from './s3-env';

describe('s3-env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('maps STORAGE_DRIVER=yandex to s3', () => {
    process.env.STORAGE_DRIVER = 'yandex';
    expect(resolveStorageDriver()).toBe('s3');
  });

  it('prefers S3_* over YANDEX_* for app config', () => {
    process.env.S3_BUCKET = 'new-bucket';
    process.env.YANDEX_STORAGE_BUCKET = 'old-bucket';
    process.env.S3_PUBLIC_BASE_URL = 'https://cdn.example/new-bucket';
    process.env.S3_ENDPOINT = 'https://s3.hoster.by';
    process.env.S3_REGION = 'eu-central-1';

    const env = resolveAppS3Env();
    expect(env.bucket).toBe('new-bucket');
    expect(env.publicBaseUrl).toBe('https://cdn.example/new-bucket');
    expect(env.endpoint).toBe('https://s3.hoster.by');
  });

  it('reads source bucket from SRC_S3_*', () => {
    process.env.SRC_S3_BUCKET = 'src-bucket';
    process.env.SRC_S3_ENDPOINT = 'https://storage.yandexcloud.net';
    process.env.SRC_S3_PUBLIC_BASE_URL =
      'https://storage.yandexcloud.net/src-bucket';

    const src = resolveSrcS3Env();
    expect(src.bucket).toBe('src-bucket');
    expect(src.publicBaseUrl).toBe(
      'https://storage.yandexcloud.net/src-bucket',
    );
  });
});
