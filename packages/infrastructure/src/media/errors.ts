import { InvalidStorageKeyError } from "@barberkece/core";

/**
 * StoragePathTraversalError
 * Filesystem-specific storage error thrown when a relative key attempts to escape
 * the configured baseDirectory root on the local filesystem.
 */
export class StoragePathTraversalError extends InvalidStorageKeyError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StoragePathTraversalError";
  }
}
