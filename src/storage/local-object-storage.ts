import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import {
  extractObjectKeyFromValue,
  normalizeStorageKey,
} from './storage-object-key.util';
import type { ObjectStorage, StoredObject } from './storage.types';

@Injectable()
export class LocalObjectStorage implements ObjectStorage {
  private readonly logger = new Logger(LocalObjectStorage.name);
  private readonly root = join(process.cwd(), 'uploads');

  async putObject(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    const normalizedKey = this.normalizeKey(params.key);
    const absolutePath = join(this.root, normalizedKey);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, params.body);
    return {
      key: normalizedKey,
      url: `/uploads/${normalizedKey}`,
    };
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      return await readFile(join(this.root, this.normalizeKey(key)));
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await unlink(join(this.root, this.normalizeKey(key)));
    } catch (error) {
      this.logger.warn(
        `Failed to delete local object ${key}: ${String(error)}`,
      );
    }
  }

  resolveKeyFromUrl(url: string): string | null {
    const key = extractObjectKeyFromValue(url);
    return key || null;
  }

  private normalizeKey(key: string): string {
    return normalizeStorageKey(key);
  }
}
