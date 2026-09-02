import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { InvalidStorageKeyError, StorageError } from "@barberkece/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoragePathTraversalError } from "../errors.js";
import { LocalFilesystemMediaAdapter } from "../local-filesystem-media-adapter.js";

describe("LocalFilesystemMediaAdapter", () => {
  let tempDir: string;
  let adapter: LocalFilesystemMediaAdapter;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "barberkece-media-test-"),
    );
    adapter = new LocalFilesystemMediaAdapter({ baseDirectory: tempDir });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  describe("Configuration & Initialization", () => {
    it("initializes with a valid base directory", () => {
      expect(adapter.getBaseDirectory()).toBe(path.resolve(tempDir));
    });

    it("throws StorageError if baseDirectory is invalid or empty", () => {
      expect(
        () => new LocalFilesystemMediaAdapter({ baseDirectory: "" }),
      ).toThrow(StorageError);
    });
  });

  describe("put and get operations", () => {
    it("stores and retrieves text content", async () => {
      const key = "test/greeting.txt";
      const content = "Hello, BarberKece!";

      const metadata = await adapter.put(key, content);
      expect(metadata.key).toBe(key);
      expect(metadata.sizeBytes).toBe(Buffer.byteLength(content));
      expect(metadata.contentType).toBe("text/plain");

      const obj = await adapter.get(key);
      expect(obj).not.toBeNull();
      expect(obj?.data.toString("utf8")).toBe(content);
      expect(obj?.sizeBytes).toBe(Buffer.byteLength(content));
      expect(obj?.contentType).toBe("text/plain");
    });

    it("stores and retrieves binary buffer data", async () => {
      const key = "images/sample.png";
      const binaryData = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      await adapter.put(key, binaryData);
      const retrieved = await adapter.get(key);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.data).toEqual(binaryData);
      expect(retrieved?.contentType).toBe("image/png");
    });

    it("creates nested subdirectories automatically", async () => {
      const key = "deep/nested/sub/directory/file.json";
      const jsonContent = JSON.stringify({ name: "BarberKece" });

      await adapter.put(key, jsonContent);
      const obj = await adapter.get(key);

      expect(obj).not.toBeNull();
      expect(obj?.contentType).toBe("application/json");
      expect(JSON.parse(obj!.data.toString("utf8"))).toEqual({
        name: "BarberKece",
      });
    });

    it("honors explicit contentType override in put options", async () => {
      const key = "custom/file.custom";
      await adapter.put(key, "content", {
        contentType: "application/custom-type",
      });

      const metadata = await adapter.getMetadata(key);
      expect(metadata?.contentType).toBe("application/custom-type");
    });

    it("returns null when getting a non-existent key", async () => {
      const obj = await adapter.get("does-not-exist.jpg");
      expect(obj).toBeNull();
    });

    it("overwrites existing files on subsequent put", async () => {
      const key = "avatar.jpg";
      await adapter.put(key, "version-1");
      await adapter.put(key, "version-2");

      const obj = await adapter.get(key);
      expect(obj?.data.toString("utf8")).toBe("version-2");
    });
  });

  describe("exists and getMetadata operations", () => {
    it("returns true for existing objects and false for missing objects", async () => {
      const key = "profiles/user-1.webp";
      expect(await adapter.exists(key)).toBe(false);

      await adapter.put(key, Buffer.from("image data"));
      expect(await adapter.exists(key)).toBe(true);
    });

    it("returns metadata without downloading the full object body", async () => {
      const key = "docs/guide.pdf";
      await adapter.put(key, "sample pdf content");

      const metadata = await adapter.getMetadata(key);
      expect(metadata).not.toBeNull();
      expect(metadata?.key).toBe(key);
      expect(metadata?.contentType).toBe("application/pdf");
      expect(metadata?.sizeBytes).toBeGreaterThan(0);
      expect(metadata?.updatedAt).toBeInstanceOf(Date);
    });

    it("returns null for getMetadata on non-existent object", async () => {
      const metadata = await adapter.getMetadata("missing.txt");
      expect(metadata).toBeNull();
    });
  });

  describe("delete operations", () => {
    it("deletes an existing file and returns true", async () => {
      const key = "temp/to-delete.txt";
      await adapter.put(key, "temporary");

      expect(await adapter.exists(key)).toBe(true);
      const deleted = await adapter.delete(key);
      expect(deleted).toBe(true);
      expect(await adapter.exists(key)).toBe(false);
    });

    it("returns false when deleting a non-existent file without error", async () => {
      const deleted = await adapter.delete("non-existent-file.txt");
      expect(deleted).toBe(false);
    });
  });

  describe("Security & Path Traversal Protections", () => {
    it("rejects path traversal attempts with ../", async () => {
      await expect(adapter.put("../secret.txt", "evil")).rejects.toThrow(
        StoragePathTraversalError,
      );
      await expect(adapter.get("../secret.txt")).rejects.toThrow(
        StoragePathTraversalError,
      );
      await expect(adapter.delete("../secret.txt")).rejects.toThrow(
        StoragePathTraversalError,
      );
      await expect(adapter.exists("../secret.txt")).rejects.toThrow(
        StoragePathTraversalError,
      );
    });

    it("rejects deeply nested path traversal attempts", async () => {
      await expect(
        adapter.put("images/../../outside.txt", "evil"),
      ).rejects.toThrow(StoragePathTraversalError);
    });

    it("rejects Windows backslash traversal attempts", async () => {
      await expect(
        adapter.put("..\\..\\windows\\system32\\evil.dll", "evil"),
      ).rejects.toThrow(StoragePathTraversalError);
    });

    it("rejects empty or whitespace-only keys", async () => {
      await expect(adapter.put("", "data")).rejects.toThrow(
        InvalidStorageKeyError,
      );
      await expect(adapter.put("   ", "data")).rejects.toThrow(
        InvalidStorageKeyError,
      );
    });

    it("rejects null-byte injection keys", async () => {
      await expect(adapter.put("image.png\0.exe", "data")).rejects.toThrow(
        InvalidStorageKeyError,
      );
    });
  });
});
