export interface StoredObject {
  /** Публичный URL или относительный путь (/uploads/...). */
  url: string;
  /** Ключ объекта в бакете / относительный путь на диске. */
  key: string;
}

export interface ObjectStorage {
  putObject(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredObject>;

  getObject(key: string): Promise<Buffer | null>;

  deleteObject(key: string): Promise<void>;

  /** Преобразует публичный URL или /uploads/... в storage key, если объект наш. */
  resolveKeyFromUrl(url: string): string | null;
}
