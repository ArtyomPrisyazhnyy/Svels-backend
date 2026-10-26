import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import type { ObjectStorage, StoredObject } from './storage.types';

@Injectable()
export class LocalObjectStorage implements ObjectStorage {
  private readonly logger = new Logger(LocalObjectStorage.name);
  private readonly root = resolve(join(process.cwd(), 'uploads'));

  async putObject(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    const normalizedKey = this.normalizeKey(params.key);
    const absolutePath = this.resolveAbsolutePath(normalizedKey);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, params.body);
    return {
      key: normalizedKey,
      url: `/uploads/${normalizedKey}`,
    };
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolveAbsolutePath(this.normalizeKey(key)));
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await unlink(this.resolveAbsolutePath(this.normalizeKey(key)));
    } catch (error) {
      this.logger.warn(
        `Failed to delete local object ${key}: ${String(error)}`,
      );
    }
  }

  resolveKeyFromUrl(url: string): string | null {
    if (!url) {
      return null;
    }

    if (url.startsWith('/uploads/')) {
      return this.normalizeKey(url.slice('/uploads/'.length));
    }

    try {
      const { pathname } = new URL(url);
      if (pathname.startsWith('/uploads/')) {
        return this.normalizeKey(pathname.slice('/uploads/'.length));
      }
    } catch {
      // ignore
    }

    return null;
  }

  private normalizeKey(key: string): string {
    const stripped = key.replace(/^\/+/, '').replace(/^uploads\//, '');
    if (stripped.includes('..')) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    const segments = stripped
      .split('/')
      .filter((segment) => segment.length > 0);
    if (segments.length === 0) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return segments.join('/');
  }

  private resolveAbsolutePath(normalizedKey: string): string {
    const absolutePath = resolve(this.root, normalizedKey);
    if (
      absolutePath !== this.root &&
      !absolutePath.startsWith(`${this.root}/`)
    ) {
      throw new Error(`Invalid storage key path: ${normalizedKey}`);
    }
    return absolutePath;
  }
}
