import { describe, it, expect, vi } from "vitest";
import type { DatabaseClient, Database } from "../../client.js";
import {
  validateTestDatabaseUrl,
  verifyConnectedServer,
  redactConnectionUrl,
  isLocalHost,
  TestDatabaseSafetyError,
  SafeTestDatabaseContext,
} from "../test-database-guard.js";

describe("Test Database Safety Guard", () => {
  describe("redactConnectionUrl", () => {
    it("redacts credentials from connection URLs", () => {
      const url =
        "postgres://myuser:secretpassword@localhost:5432/barberkece_test";
      const redacted = redactConnectionUrl(url);
      expect(redacted).not.toContain("secretpassword");
      expect(redacted).not.toContain("myuser");
      expect(redacted).toContain("***");
      expect(redacted).toContain("localhost:5432/barberkece_test");
    });

    it("handles malformed URLs without throwing", () => {
      const redacted = redactConnectionUrl("not-a-valid-url");
      expect(redacted).toBe("[MALFORMED_URL_REDACTED]");
    });
  });

  describe("isLocalHost", () => {
    it("identifies localhost loopbacks correctly", () => {
      expect(isLocalHost("localhost")).toBe(true);
      expect(isLocalHost("127.0.0.1")).toBe(true);
      expect(isLocalHost("127.0.0.2")).toBe(true);
      expect(isLocalHost("::1")).toBe(true);
    });

    it("rejects non-local / remote hosts", () => {
      expect(isLocalHost("db.production.com")).toBe(false);
      expect(isLocalHost("192.168.1.100")).toBe(false);
      expect(isLocalHost("10.0.0.1")).toBe(false);
      expect(isLocalHost("aws.rds.amazonaws.com")).toBe(false);
      expect(isLocalHost("")).toBe(false);
    });
  });

  describe("validateTestDatabaseUrl", () => {
    it("rejects undefined or missing TEST_DATABASE_URL", () => {
      expect(() => validateTestDatabaseUrl(undefined)).toThrowError(
        TestDatabaseSafetyError,
      );
      expect(() => validateTestDatabaseUrl(undefined)).toThrow(
        /TEST_DATABASE_URL is not set/,
      );

      expect(() => validateTestDatabaseUrl("")).toThrowError(
        TestDatabaseSafetyError,
      );
      expect(() => validateTestDatabaseUrl("   ")).toThrowError(
        TestDatabaseSafetyError,
      );
    });

    it("rejects malformed URLs", () => {
      expect(() => validateTestDatabaseUrl("invalid-url-string")).toThrowError(
        TestDatabaseSafetyError,
      );
      expect(() => validateTestDatabaseUrl("invalid-url-string")).toThrow(
        /malformed/,
      );
    });

    it("rejects non-postgres protocols", () => {
      expect(() =>
        validateTestDatabaseUrl("http://localhost:5432/barberkece_test"),
      ).toThrowError(TestDatabaseSafetyError);
      expect(() =>
        validateTestDatabaseUrl("http://localhost:5432/barberkece_test"),
      ).toThrow(/protocol must be 'postgres:' or 'postgresql:'/);
    });

    it("rejects remote or non-loopback hostnames", () => {
      const remoteUrl =
        "postgres://user:pass@db.mycompany.com:5432/barberkece_test";
      expect(() => validateTestDatabaseUrl(remoteUrl)).toThrowError(
        TestDatabaseSafetyError,
      );
      expect(() => validateTestDatabaseUrl(remoteUrl)).toThrow(
        /not a local loopback address/,
      );

      const privateIpUrl =
        "postgres://user:pass@192.168.1.50:5432/barberkece_test";
      expect(() => validateTestDatabaseUrl(privateIpUrl)).toThrowError(
        TestDatabaseSafetyError,
      );
    });

    it("strictly rejects barberkece_dev database", () => {
      const devUrl =
        "postgres://barberkece_dev:devpassword@localhost:5432/barberkece_dev";
      expect(() => validateTestDatabaseUrl(devUrl)).toThrowError(
        TestDatabaseSafetyError,
      );
      expect(() => validateTestDatabaseUrl(devUrl)).toThrow(
        /expected strictly 'barberkece_test'/,
      );
    });

    it("strictly rejects any database other than barberkece_test", () => {
      const defaultDbUrl = "postgres://user:pass@localhost:5432/postgres";
      expect(() => validateTestDatabaseUrl(defaultDbUrl)).toThrowError(
        TestDatabaseSafetyError,
      );

      const prodDbUrl = "postgres://user:pass@localhost:5432/barberkece_prod";
      expect(() => validateTestDatabaseUrl(prodDbUrl)).toThrowError(
        TestDatabaseSafetyError,
      );
    });

    it("passes valid local barberkece_test connection URL", () => {
      const validUrl =
        "postgres://barberkece_test:testpassword@localhost:5432/barberkece_test";
      const result = validateTestDatabaseUrl(validUrl);

      expect(result.database).toBe("barberkece_test");
      expect(result.host).toBe("localhost");
      expect(result.port).toBe(5432);
      expect(result.sanitizedUrl).not.toContain("testpassword");
      expect(result.sanitizedUrl).toContain("***");
    });

    it("passes 127.0.0.1 and custom port", () => {
      const validUrl =
        "postgresql://testuser:secret@127.0.0.1:5433/barberkece_test";
      const result = validateTestDatabaseUrl(validUrl);

      expect(result.database).toBe("barberkece_test");
      expect(result.host).toBe("127.0.0.1");
      expect(result.port).toBe(5433);
    });
  });

  describe("verifyConnectedServer", () => {
    it("passes when connected to barberkece_test on local server", async () => {
      const mockDb = {
        execute: vi
          .fn()
          .mockResolvedValueOnce([
            {
              current_database: "barberkece_test",
              server_addr: "127.0.0.1",
              server_port: 5432,
            },
          ])
          .mockResolvedValueOnce([{ ping: 1 }]),
      };

      const result = await verifyConnectedServer(mockDb);
      expect(result.currentDatabase).toBe("barberkece_test");
      expect(result.serverAddr).toBe("127.0.0.1");
      expect(result.ping).toBe(1);
    });

    it("passes when connected via local unix-domain socket (server_addr is null)", async () => {
      const mockDb = {
        execute: vi
          .fn()
          .mockResolvedValueOnce([
            {
              current_database: "barberkece_test",
              server_addr: null,
              server_port: 5432,
            },
          ])
          .mockResolvedValueOnce([{ ping: 1 }]),
      };

      const result = await verifyConnectedServer(mockDb);
      expect(result.currentDatabase).toBe("barberkece_test");
      expect(result.serverAddr).toBeNull();
      expect(result.ping).toBe(1);
    });

    it("fails closed if current_database is NOT barberkece_test (e.g. barberkece_dev)", async () => {
      const mockDb = {
        execute: vi.fn().mockResolvedValue([
          {
            current_database: "barberkece_dev",
            server_addr: "127.0.0.1",
            server_port: 5432,
          },
        ]),
      };

      await expect(verifyConnectedServer(mockDb)).rejects.toThrowError(
        /Connected database is 'barberkece_dev', expected strictly 'barberkece_test'/,
      );
    });

    it("fails closed if server_addr is a remote IP even if database name matches", async () => {
      const mockDb = {
        execute: vi.fn().mockResolvedValue([
          {
            current_database: "barberkece_test",
            server_addr: "192.168.1.150",
            server_port: 5432,
          },
        ]),
      };

      await expect(verifyConnectedServer(mockDb)).rejects.toThrowError(
        /not a local loopback address/,
      );
    });

    it("fails closed if ping health check fails", async () => {
      const mockDb = {
        execute: vi
          .fn()
          .mockResolvedValueOnce([
            {
              current_database: "barberkece_test",
              server_addr: "127.0.0.1",
              server_port: 5432,
            },
          ])
          .mockResolvedValueOnce([{ ping: 0 }]),
      };

      await expect(verifyConnectedServer(mockDb)).rejects.toThrowError(
        /Health check query \(SELECT 1\) failed/,
      );
    });
  });

  describe("safeCleanup guard", () => {
    it("refuses to execute cleanup if context is unverified", async () => {
      const cleanupMock = vi.fn();

      const mockContext: SafeTestDatabaseContext = {
        dbClient: {} as unknown as DatabaseClient,
        db: {} as unknown as Database,
        isVerified: false,
        close: vi.fn(),
        safeCleanup: async (cleanupFn) => {
          if (!mockContext.isVerified) {
            throw new TestDatabaseSafetyError(
              "Refusing to execute test cleanup on unverified database connection.",
            );
          }
          await cleanupFn();
        },
      };

      await expect(mockContext.safeCleanup(cleanupMock)).rejects.toThrowError(
        TestDatabaseSafetyError,
      );
      expect(cleanupMock).not.toHaveBeenCalled();
    });

    it("executes cleanup callback when context is verified", async () => {
      const cleanupMock = vi.fn().mockResolvedValue(undefined);

      const mockContext: SafeTestDatabaseContext = {
        dbClient: {} as unknown as DatabaseClient,
        db: {} as unknown as Database,
        isVerified: true,
        close: vi.fn(),
        safeCleanup: async (cleanupFn) => {
          if (!mockContext.isVerified) {
            throw new TestDatabaseSafetyError(
              "Refusing to execute test cleanup.",
            );
          }
          await cleanupFn();
        },
      };

      await mockContext.safeCleanup(cleanupMock);
      expect(cleanupMock).toHaveBeenCalledTimes(1);
    });
  });
});
