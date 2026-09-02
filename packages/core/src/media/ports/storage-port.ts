export interface StorageMetadata {
  key: string;
  sizeBytes: number;
  contentType: string;
  updatedAt: Date;
}

export interface PutStorageOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageObject {
  key: string;
  data: Buffer;
  sizeBytes: number;
  contentType: string;
  updatedAt: Date;
}

/**
 * StoragePort defines the contract for binary/media object storage.
 * Implementations (LocalFilesystem, Cloudflare R2, S3) live in infrastructure.
 */
export interface StoragePort {
  /**
   * Store binary content at the specified key.
   * Overwrites if object already exists at key.
   */
  put(
    key: string,
    content: Buffer | Uint8Array | string,
    options?: PutStorageOptions,
  ): Promise<StorageMetadata>;

  /**
   * Retrieve binary object by key. Returns null if object not found.
   */
  get(key: string): Promise<StorageObject | null>;

  /**
   * Delete object at the specified key. Returns true if deleted, false if not found.
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if an object exists at the specified key.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Retrieve metadata for an object without downloading its payload.
   * Returns null if object not found.
   */
  getMetadata(key: string): Promise<StorageMetadata | null>;
}
