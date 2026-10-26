import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { ConfigService } from '@nestjs/config';
import { S3ObjectStorage } from './s3-object-storage';

const s3Mock = mockClient(S3Client);

describe('S3ObjectStorage', () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  function createStorage(): S3ObjectStorage {
    const configService = {
      get: (key: string, fallback?: unknown) => {
        if (key === 'storage.s3') {
          return {
            bucket: 'media-bucket',
            accessKeyId: 'key',
            secretAccessKey: 'secret',
            region: 'eu-central-1',
            endpoint: 'https://s3.example.com',
            publicBaseUrl: 'https://cdn.example.com/media-bucket',
            forcePathStyle: true,
            legacyPublicBaseUrls: [
              'https://storage.yandexcloud.net/media-bucket',
            ],
          };
        }
        return fallback;
      },
    } as ConfigService;

    return new S3ObjectStorage(configService);
  }

  it('putObject uploads and returns public URL', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    const storage = createStorage();
    const result = await storage.putObject({
      key: 'menu/item.jpg',
      body: Buffer.from('jpeg'),
      contentType: 'image/jpeg',
    });

    expect(result).toEqual({
      key: 'menu/item.jpg',
      url: 'https://cdn.example.com/media-bucket/menu/item.jpg',
    });
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
  });

  it('resolveKeyFromUrl supports legacy Yandex URLs', () => {
    const storage = createStorage();
    expect(
      storage.resolveKeyFromUrl(
        'https://storage.yandexcloud.net/media-bucket/menu/x.webp',
      ),
    ).toBe('menu/x.webp');
  });

  it('getObject returns buffer from S3 body', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: {
        transformToByteArray: () => Promise.resolve(Uint8Array.from([1, 2, 3])),
      },
    });

    const storage = createStorage();
    const data = await storage.getObject('a.bin');
    expect(data?.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it('deleteObject sends DeleteObjectCommand', async () => {
    s3Mock.on(DeleteObjectCommand).resolves({});
    const storage = createStorage();
    await storage.deleteObject('remove-me.jpg');
    expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1);
  });
});
