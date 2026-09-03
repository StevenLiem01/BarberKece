import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAuthenticatedUser } from "../auth.js";
import { cookies } from "next/headers";
import { User } from "@barberkece/core/identity";
import { logger } from "@barberkece/infrastructure/logging";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

// Mock the logger
vi.mock("@barberkece/infrastructure/logging", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Mock the getDatabaseClient
vi.mock("@/lib/db", () => ({
  getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

// Mock implementations for adapters and repositories so instantiation doesn't fail
vi.mock("@barberkece/database/repositories", () => ({
  PostgresUserRepository: vi.fn(),
  PostgresSessionRepository: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/identity", () => ({
  NodeCryptoTokenAdapter: vi.fn(),
}));

// Mock the core use case
const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock("@barberkece/core/identity", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/identity")>();
  return {
    ...actual,
    ResolveAuthenticatedUserUseCase: vi.fn().mockImplementation(function () {
      return { execute: mockExecute };
    }),
  };
});

describe("getAuthenticatedUser", () => {
  const validUser: User = {
    id: "user-123",
    email: "test@example.com",
    role: "CUSTOMER",
    status: "ACTIVE",
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves user from valid cookie without exposing raw token or hashes", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "valid-raw-token" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    mockExecute.mockResolvedValue(validUser);

    const user = await getAuthenticatedUser();

    expect(user).toEqual(validUser);
    expect(mockExecute).toHaveBeenCalledWith("valid-raw-token");
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).not.toHaveProperty("tokenHash");
    expect(user).not.toHaveProperty("rawToken");
  });

  it("returns null when cookie is missing", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const user = await getAuthenticatedUser();

    expect(user).toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns null when cookie is invalid or session is missing/expired", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "expired-raw-token" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    mockExecute.mockResolvedValue(null);

    const user = await getAuthenticatedUser();

    expect(user).toBeNull();
    expect(mockExecute).toHaveBeenCalledWith("expired-raw-token");
  });

  it("returns null when user is missing or inactive as resolved by use case", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "inactive-user-token" }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    mockExecute.mockResolvedValue(null);

    const user = await getAuthenticatedUser();

    expect(user).toBeNull();
    expect(mockExecute).toHaveBeenCalledWith("inactive-user-token");
  });

  it("logs safely and re-throws on unexpected database/infrastructure failure", async () => {
    const rawToken = "sensitive-raw-cookie-token-12345";
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: rawToken }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const dbError = new Error("Database connection lost");
    mockExecute.mockRejectedValue(dbError);

    await expect(getAuthenticatedUser()).rejects.toThrow(
      "Database connection lost",
    );

    expect(logger.error).toHaveBeenCalledWith(
      { err: dbError },
      "Unexpected error resolving authenticated user",
    );
    const loggedCalls = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(loggedCalls).not.toContain(rawToken);
  });

  it("logs safely and re-throws on TokenPort/crypto failure", async () => {
    const rawToken = "sensitive-raw-cookie-token-67890";
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: rawToken }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const cryptoError = new Error("Token hashing failed");
    mockExecute.mockRejectedValue(cryptoError);

    await expect(getAuthenticatedUser()).rejects.toThrow(
      "Token hashing failed",
    );

    expect(logger.error).toHaveBeenCalledWith(
      { err: cryptoError },
      "Unexpected error resolving authenticated user",
    );
    const loggedCalls = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(loggedCalls).not.toContain(rawToken);
  });
});
