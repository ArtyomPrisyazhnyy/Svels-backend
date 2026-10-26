import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createS3ClientConfig, type ResolvedS3Env } from '../config/s3-env';
import { resolveObjectKeyFromUrl } from './object-key-from-url';
import type { ObjectStorage, StoredObject } from './storage.types';

@Injectable()
export class S3ObjectStorage implements ObjectStorage, OnModuleInit {
  private readonly logger = new Logger(S3ObjectStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly legacyPublicBaseUrls: string[];

  constructor(private readonly configService: ConfigService) {
    const s3 = this.configService.get<ResolvedS3Env>('storage.s3', {
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
      region: '',
      endpoint: '',
      publicBaseUrl: '',
      forcePathStyle: true,
      legacyPublicBaseUrls: [],
    });

    this.bucket = s3.bucket;
    this.publicBaseUrl = s3.publicBaseUrl.replace(/\/$/, '');
    this.legacyPublicBaseUrls = s3.legacyPublicBaseUrls;

    this.client = new S3Client(createS3ClientConfig(s3));
  }

  onModuleInit(): void {
    if (!this.bucket || !this.publicBaseUrl) {
      this.logger.error(
        'S3 storage включён (STORAGE_DRIVER=s3), но не заданы S3_BUCKET / S3_PUBLIC_BASE_URL',
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
    return resolveObjectKeyFromUrl(url, {
      bucket: this.bucket,
      publicBaseUrl: this.publicBaseUrl,
      legacyPublicBaseUrls: this.legacyPublicBaseUrls,
    });
  }

  private normalizeKey(key: string): string {
    return key.replace(/^\/+/, '');
  }
}
