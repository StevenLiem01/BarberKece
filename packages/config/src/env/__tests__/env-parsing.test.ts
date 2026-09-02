import { describe, it, expect } from "vitest";
import { parseEnv, safeParseEnv } from "../parse-env.js";

const VALID_ENV = {
  NODE_ENV: "development" as const,
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  BUSINESS_TIMEZONE: "Asia/Jakarta",
};

describe("parseEnv", () => {
  it("accepts a fully valid environment", () => {
    const result = parseEnv(VALID_ENV);

    expect(result.NODE_ENV).toBe("development");
    expect(result.APP_URL).toBe("http://localhost:3000");
    expect(result.DATABASE_URL).toBe(
      "postgresql://user:pass@localhost:5432/db",
    );
    expect(result.BUSINESS_TIMEZONE).toBe("Asia/Jakarta");
  });

  it("applies NODE_ENV default when absent", () => {
    const result = parseEnv({
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    });

    expect(result.NODE_ENV).toBe("development");
  });

  it("applies BUSINESS_TIMEZONE default when absent", () => {
    const result = parseEnv({
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    });

    expect(result.BUSINESS_TIMEZONE).toBe("Asia/Jakarta");
  });

  it("throws when APP_URL is absent", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "postgresql://user:pass@localhost:5432/db" }),
    ).toThrow("Invalid environment configuration");
  });

  it("throws when APP_URL is not a valid URL", () => {
    expect(() =>
      parseEnv({
        APP_URL: "not-a-url",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      }),
    ).toThrow("APP_URL must be a valid URL");
  });

  it("throws when DATABASE_URL is absent", () => {
    expect(() => parseEnv({ APP_URL: "http://localhost:3000" })).toThrow(
      "Invalid environment configuration",
    );
  });

  it("throws when DATABASE_URL is empty string", () => {
    expect(() =>
      parseEnv({ APP_URL: "http://localhost:3000", DATABASE_URL: "" }),
    ).toThrow("DATABASE_URL is required");
  });

  it("throws when NODE_ENV is an invalid value", () => {
    expect(() =>
      parseEnv({
        ...VALID_ENV,
        NODE_ENV: "staging",
      }),
    ).toThrow("Invalid environment configuration");
  });
});

describe("safeParseEnv", () => {
  it("returns success: true for valid input", () => {
    const result = safeParseEnv(VALID_ENV);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.APP_URL).toBe("http://localhost:3000");
    }
  });

  it("returns success: false for missing required fields", () => {
    const result = safeParseEnv({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain(
        "Invalid environment configuration",
      );
    }
  });

  it("includes field-level details for missing required fields", () => {
    const result = safeParseEnv({});

    expect(result.success).toBe(false);
    if (!result.success) {
      // APP_URL and DATABASE_URL are both required
      expect(Object.keys(result.details)).toContain("APP_URL");
      expect(Object.keys(result.details)).toContain("DATABASE_URL");
    }
  });

  it("accepts production as a valid NODE_ENV", () => {
    const result = safeParseEnv({ ...VALID_ENV, NODE_ENV: "production" });

    expect(result.success).toBe(true);
  });

  it("accepts test as a valid NODE_ENV", () => {
    const result = safeParseEnv({ ...VALID_ENV, NODE_ENV: "test" });

    expect(result.success).toBe(true);
  });
});
