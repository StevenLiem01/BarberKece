import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDatabaseClient } from "../db.js";
import * as dbPackage from "@barberkece/database";

vi.mock("@barberkece/database", () => ({
  createDatabase: vi.fn((url: string) => ({
    db: { url },
    close: vi.fn(),
  })),
}));

describe("getDatabaseClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete globalThis.__barberkece_db_client__;
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://testuser:testpass@localhost:5432/testdb",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    delete globalThis.__barberkece_db_client__;
  });

  it("sources DATABASE_URL through canonical config and creates client", () => {
    const client = getDatabaseClient();

    expect(dbPackage.createDatabase).toHaveBeenCalledWith(
      "postgresql://testuser:testpass@localhost:5432/testdb",
    );
    expect(client).toBeDefined();
  });

  it("caches client on globalThis in development across multiple calls (HMR safe)", () => {
    const client1 = getDatabaseClient();
    const client2 = getDatabaseClient();

    expect(dbPackage.createDatabase).toHaveBeenCalledTimes(1);
    expect(client1).toBe(client2);
    expect(globalThis.__barberkece_db_client__).toBe(client1);
  });

  it("reuses module-level client without mutating globalThis in production", () => {
    Object.assign(process.env, { NODE_ENV: "production" });

    const client1 = getDatabaseClient();
    const client2 = getDatabaseClient();

    expect(dbPackage.createDatabase).toHaveBeenCalledTimes(1);
    expect(client1).toBe(client2);
    expect(globalThis.__barberkece_db_client__).toBeUndefined();
  });

  it("throws if canonical config is invalid (e.g., missing DATABASE_URL)", () => {
    delete process.env.DATABASE_URL;

    expect(() => getDatabaseClient()).toThrow(
      "Invalid environment configuration",
    );
  });
});
