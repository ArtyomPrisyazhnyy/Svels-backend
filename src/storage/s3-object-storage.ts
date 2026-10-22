import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  extractObjectKeyFromValue,
  normalizeStorageKey,
} from './storage-object-key.util';
import type { ObjectStorage, StoredObject } from './storage.types';

@Injectable()
export class S3ObjectStorage implements ObjectStorage, OnModuleInit {
  private readonly logger = new Logger(S3ObjectStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('storage.s3.bucket', '');
    this.publicBaseUrl = this.configService
      .get<string>('storage.s3.publicBaseUrl', '')
      .replace(/\/$/, '');

    this.client = new S3Client({
      region: this.configService.get<string>('storage.s3.region', 'us-east-1'),
      endpoint: this.configService.get<string>('storage.s3.endpoint', ''),
      credentials: {
        accessKeyId: this.configService.get<string>(
          'storage.s3.accessKeyId',
          '',
        ),
        secretAccessKey: this.configService.get<string>(
          'storage.s3.secretAccessKey',
          '',
        ),
      },
      forcePathStyle: this.configService.get<boolean>(
        'storage.s3.forcePathStyle',
        true,
      ),
    });
  }

  onModuleInit(): void {
    if (!this.bucket || !this.publicBaseUrl) {
      this.logger.error(
        'S3 storage включён, но не заданы S3_BUCKET / S3_PUBLIC_BASE_URL',
      );
    } else {
      this.logger.log(`S3 object storage bucket=${this.bucket}`);
    }
  }

  async putObject(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    const key = normalizeStorageKey(params.key);
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
          Key: normalizeStorageKey(key),
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
          Key: normalizeStorageKey(key),
        }),
      );
    } catch (error) {
      this.logger.warn(`Failed to delete object ${key}: ${String(error)}`);
    }
  }

  resolveKeyFromUrl(url: string): string | null {
    const key = extractObjectKeyFromValue(url, {
      publicBaseUrl: this.publicBaseUrl,
      bucket: this.bucket,
    });
    return key || null;
  }
}
