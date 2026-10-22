import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildPublicMediaUrl,
  extractObjectKeyFromValue,
  type StorageDriver,
} from './storage-object-key.util';

@Injectable()
export class PublicMediaUrlService {
  constructor(private readonly configService: ConfigService) {}

  get driver(): StorageDriver {
    const raw = this.configService.get<string>('storage.driver', 'local');
    return raw === 's3' ? 's3' : 'local';
  }

  get publicBaseUrl(): string {
    if (this.driver === 's3') {
      return (
        this.configService.get<string>('storage.s3.publicBaseUrl', '') || ''
      );
    }
    return '/uploads';
  }

  get bucket(): string {
    return this.configService.get<string>('storage.s3.bucket', '') || '';
  }

  toPublicUrl(keyOrUrl: string | null | undefined): string | null {
    if (keyOrUrl == null || keyOrUrl === '') {
      return null;
    }

    const key = this.toStorageKey(keyOrUrl);
    if (!key) {
      return null;
    }

    return buildPublicMediaUrl(this.driver, key, this.publicBaseUrl);
  }

  toPublicUrls(keysOrUrls: string[] | null | undefined): string[] {
    if (!keysOrUrls?.length) {
      return [];
    }
    return keysOrUrls
      .map((value) => this.toPublicUrl(value))
      .filter((url): url is string => Boolean(url));
  }

  toStorageKey(value: string | null | undefined): string {
    if (!value?.trim()) {
      return '';
    }

    return extractObjectKeyFromValue(value, {
      publicBaseUrl: this.publicBaseUrl,
      bucket: this.bucket,
    });
  }
}
