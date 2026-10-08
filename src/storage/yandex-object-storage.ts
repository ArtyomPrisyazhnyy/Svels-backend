import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ObjectStorage, StoredObject } from './storage.types';

@Injectable()
export class YandexObjectStorage implements ObjectStorage, OnModuleInit {
  private readonly logger = new Logger(YandexObjectStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('storage.yandex.bucket', '');
    this.publicBaseUrl = this.configService
      .get<string>('storage.yandex.publicBaseUrl', '')
      .replace(/\/$/, '');

    this.client = new S3Client({
      region: this.configService.get<string>(
        'storage.yandex.region',
        'ru-central1',
      ),
      endpoint: this.configService.get<string>(
        'storage.yandex.endpoint',
        'https://storage.yandexcloud.net',
      ),
      credentials: {
        accessKeyId: this.configService.get<string>(
          'storage.yandex.accessKeyId',
          '',
        ),
        secretAccessKey: this.configService.get<string>(
          'storage.yandex.secretAccessKey',
          '',
        ),
      },
      forcePathStyle: true,
    });
  }

  onModuleInit(): void {
    if (!this.bucket || !this.publicBaseUrl) {
      this.logger.error(
        'Yandex Object Storage включён, но не заданы YANDEX_STORAGE_BUCKET / PUBLIC_BASE_URL',
      );
    } else {
      this.logger.log(`Yandex Object Storage bucket=${this.bucket}`);
    }
  }

  async putObject(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    const key = this.normalizeKey(params.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.body,
        ContentType: params.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return {
      key,
      url: `${this.publicBaseUrl}/${key}`,
    };
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.normalizeKey(key),
        }),
      );
      if (!response.Body) {
        return null;
      }
      return Buffer.from(await response.Body.transformToByteArray());
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.normalizeKey(key),
        }),
      );
    } catch (error) {
      this.logger.warn(`Failed to delete object ${key}: ${String(error)}`);
    }
  }

  resolveKeyFromUrl(url: string): string | null {
    if (!url) {
      return null;
    }

    const base = this.publicBaseUrl;
    if (base && url.startsWith(`${base}/`)) {
      return this.normalizeKey(url.slice(base.length + 1));
    }

    try {
      const parsed = new URL(url);
      const path = parsed.pathname.replace(/^\/+/, '');
      if (path.startsWith(`${this.bucket}/`)) {
        return this.normalizeKey(path.slice(this.bucket.length + 1));
      }
      // virtual-hosted: bucket.storage.yandexcloud.net/key
      if (parsed.hostname.startsWith(`${this.bucket}.`)) {
        return this.normalizeKey(path);
      }
    } catch {
      // ignore
    }

    if (url.startsWith('/uploads/')) {
      return this.normalizeKey(url.slice('/uploads/'.length));
    }

    return null;
  }

  private normalizeKey(key: string): string {
    return key.replace(/^\/+/, '');
  }
}
