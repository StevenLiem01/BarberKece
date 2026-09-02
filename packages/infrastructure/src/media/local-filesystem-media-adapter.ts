import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  type PutStorageOptions,
  type StorageMetadata,
  type StorageObject,
  type StoragePort,
  InvalidStorageKeyError,
  StorageError,
} from "@barberkece/core";
import { StoragePathTraversalError } from "./errors.js";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
};

interface SidecarMetadata {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface LocalFilesystemMediaAdapterConfig {
  /**
   * Root directory path on the local filesystem where media files will be stored.
   */
  baseDirectory: string;
}

/**
 * LocalFilesystemMediaAdapter
 * Development storage adapter implementing StoragePort using local filesystem storage.
 * Enforces strict path containment within baseDirectory to prevent path traversal.
 */
export class LocalFilesystemMediaAdapter implements StoragePort {
  private readonly baseDirectory: string;

  constructor(config: LocalFilesystemMediaAdapterConfig) {
    if (!config.baseDirectory || typeof config.baseDirectory !== "string") {
      throw new StorageError(
        "LocalFilesystemMediaAdapter requires a valid baseDirectory configuration.",
      );
    }
    this.baseDirectory = path.resolve(config.baseDirectory);
  }

  /**
   * Returns the resolved root base directory.
   */
  getBaseDirectory(): string {
    return this.baseDirectory;
  }

  /**
   * Resolves and verifies that the given storage key safely stays within baseDirectory.
   */
  resolveSafePath(key: string): string {
    if (!key || typeof key !== "string" || key.trim() === "") {
      throw new InvalidStorageKeyError(
        "Storage key must be a non-empty string",
      );
    }

    if (key.includes("\0")) {
      throw new InvalidStorageKeyError(
        "Storage key contains invalid null byte character",
      );
    }

    // Strip leading slashes to prevent absolute path override on POSIX
    const strippedKey = key.replace(/^[/\\]+/, "");
    const resolvedPath = path.resolve(this.baseDirectory, strippedKey);

    // Verify the resolved path is inside baseDirectory
    const relative = path.relative(this.baseDirectory, resolvedPath);
    const isInside =
      !relative.startsWith("..") &&
      !path.isAbsolute(relative) &&
      relative !== "";

    if (!isInside && resolvedPath !== this.baseDirectory) {
      throw new StoragePathTraversalError(
        `Access denied: storage key '${key}' traverses outside root media directory`,
      );
    }

    return resolvedPath;
  }

  private inferContentType(key: string): string {
    const ext = path.extname(key).toLowerCase();
    return EXTENSION_CONTENT_TYPES[ext] ?? DEFAULT_CONTENT_TYPE;
  }

  private getSidecarPath(filePath: string): string {
    return `${filePath}.meta.json`;
  }

  private async readSidecarMetadata(
    filePath: string,
  ): Promise<SidecarMetadata | null> {
    try {
      const raw = await fs.readFile(this.getSidecarPath(filePath), "utf8");
      return JSON.parse(raw) as SidecarMetadata;
    } catch {
      return null;
    }
  }

  async put(
    key: string,
    content: Buffer | Uint8Array | string,
    options?: PutStorageOptions,
  ): Promise<StorageMetadata> {
    const filePath = this.resolveSafePath(key);
    const dirPath = path.dirname(filePath);

    try {
      await fs.mkdir(dirPath, { recursive: true });
      const bufferData = Buffer.isBuffer(content)
        ? content
        : typeof content === "string"
          ? Buffer.from(content, "utf8")
          : Buffer.from(content);

      await fs.writeFile(filePath, bufferData);

      const effectiveContentType =
        options?.contentType && options.contentType.trim() !== ""
          ? options.contentType
          : this.inferContentType(key);

      if (options?.contentType || options?.metadata) {
        const sidecarData: SidecarMetadata = {
          contentType: effectiveContentType,
          metadata: options?.metadata,
        };
        await fs.writeFile(
          this.getSidecarPath(filePath),
          JSON.stringify(sidecarData, null, 2),
          "utf8",
        );
      }

      const stat = await fs.stat(filePath);

      return {
        key,
        sizeBytes: stat.size,
        contentType: effectiveContentType,
        updatedAt: stat.mtime,
      };
    } catch (error) {
      if (
        error instanceof StorageError ||
        error instanceof StoragePathTraversalError ||
        error instanceof InvalidStorageKeyError
      ) {
        throw error;
      }
      throw new StorageError(
        `Failed to store object '${key}': ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  async get(key: string): Promise<StorageObject | null> {
    const filePath = this.resolveSafePath(key);

    try {
      const [data, stat, sidecar] = await Promise.all([
        fs.readFile(filePath),
        fs.stat(filePath),
        this.readSidecarMetadata(filePath),
      ]);

      const contentType =
        sidecar?.contentType && sidecar.contentType.trim() !== ""
          ? sidecar.contentType
          : this.inferContentType(key);

      return {
        key,
        data,
        sizeBytes: stat.size,
        contentType,
        updatedAt: stat.mtime,
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      if (
        error instanceof StorageError ||
        error instanceof StoragePathTraversalError ||
        error instanceof InvalidStorageKeyError
      ) {
        throw error;
      }
      throw new StorageError(
        `Failed to retrieve object '${key}': ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  async delete(key: string): Promise<boolean> {
    const filePath = this.resolveSafePath(key);

    try {
      await fs.unlink(filePath);
      // Clean up sidecar if it exists
      try {
        await fs.unlink(this.getSidecarPath(filePath));
      } catch {
        // Ignore missing sidecar
      }
      return true;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      if (
        error instanceof StorageError ||
        error instanceof StoragePathTraversalError ||
        error instanceof InvalidStorageKeyError
      ) {
        throw error;
      }
      throw new StorageError(
        `Failed to delete object '${key}': ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveSafePath(key);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<StorageMetadata | null> {
    const filePath = this.resolveSafePath(key);

    try {
      const [stat, sidecar] = await Promise.all([
        fs.stat(filePath),
        this.readSidecarMetadata(filePath),
      ]);

      const contentType =
        sidecar?.contentType && sidecar.contentType.trim() !== ""
          ? sidecar.contentType
          : this.inferContentType(key);

      return {
        key,
        sizeBytes: stat.size,
        contentType,
        updatedAt: stat.mtime,
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      if (
        error instanceof StorageError ||
        error instanceof StoragePathTraversalError ||
        error instanceof InvalidStorageKeyError
      ) {
        throw error;
      }
      throw new StorageError(
        `Failed to get metadata for object '${key}': ${(error as Error).message}`,
        { cause: error },
      );
    }
  }
}
