import { Inject, Injectable } from '@nestjs/common';
import type { ObjectStorage, StoredObject } from './storage.types';
import { OBJECT_STORAGE } from './storage.constants';

@Injectable()
export class StorageService {
  constructor(
    @Inject(OBJECT_STORAGE)
    private readonly storage: ObjectStorage,
  ) {}

  putObject(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject> {
    return this.storage.putObject(params);
  }

  getObject(key: string): Promise<Buffer | null> {
    return this.storage.getObject(key);
  }

  deleteObject(key: string): Promise<void> {
    return this.storage.deleteObject(key);
  }

  resolveKeyFromUrl(url: string): string | null {
    return this.storage.resolveKeyFromUrl(url);
  }
}
