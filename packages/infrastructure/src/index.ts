export const INFRASTRUCTURE_PACKAGE_NAME = "@barberkece/infrastructure";

export * as media from "./media/index.js";
export {
  LocalFilesystemMediaAdapter,
  type LocalFilesystemMediaAdapterConfig,
  StoragePathTraversalError,
} from "./media/index.js";
