export class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageError";
  }
}

export class InvalidStorageKeyError extends StorageError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidStorageKeyError";
  }
}

export class ObjectNotFoundError extends StorageError {
  constructor(key: string, options?: ErrorOptions) {
    super(`Storage object not found: ${key}`, options);
    this.name = "ObjectNotFoundError";
  }
}
