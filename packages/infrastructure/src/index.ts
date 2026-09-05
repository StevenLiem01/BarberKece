export const INFRASTRUCTURE_PACKAGE_NAME = "@barberkece/infrastructure";

export * from "./logging/index.js";
export * from "./email/index.js";
export * from "./media/index.js";
export * from "./identity/index.js";

import * as media from "./media/index.js";
export { media };
export {
  LocalFilesystemMediaAdapter,
  type LocalFilesystemMediaAdapterConfig,
  StoragePathTraversalError,
} from "./media/index.js";

import * as email from "./email/index.js";
export { email };
export {
  ConsoleEmailAdapter,
  type ConsoleEmailAdapterConfig,
} from "./email/index.js";

import * as logging from "./logging/index.js";
export { logging };
export {
  type Logger,
  type LoggerOptions,
  type LogContext,
  createLogger,
  createChildLogger,
  createRequestLogger,
  logger,
  generateRequestId,
  sanitizeRequestId,
  DEFAULT_REDACT_PATHS,
  REDACTED_VALUE,
} from "./logging/index.js";
