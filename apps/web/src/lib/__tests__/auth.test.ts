import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAuthenticatedUser,
  requireAuthenticatedUser,
  requireRole,
} from "../auth.js";
import { cookies } from "next/headers";
import { User } from "@barberkece/core/identity";
import { logger } from "@barberkece/infrastructure/logging";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

// Mock next/navigation
const { mockRedirect, mockNotFound } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT: ${url}`);
  }),
  mockNotFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
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

describe("auth helpers", () => {
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

  describe("getAuthenticatedUser", () => {
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

  describe("requireAuthenticatedUser", () => {
    it("returns user if authenticated", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: "valid-raw-token" }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      mockExecute.mockResolvedValue(validUser);

      const user = await requireAuthenticatedUser();

      expect(user).toEqual(validUser);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("redirects unauthenticated user to /login by default", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      await expect(requireAuthenticatedUser()).rejects.toThrow(
        "NEXT_REDIRECT: /login",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("redirects unauthenticated user to custom redirectTo", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      await expect(requireAuthenticatedUser("/custom-login")).rejects.toThrow(
        "NEXT_REDIRECT: /custom-login",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/custom-login");
    });

    it("redirects if user is inactive (returns null from auth context)", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: "inactive-token" }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      mockExecute.mockResolvedValue(null);

      await expect(requireAuthenticatedUser()).rejects.toThrow(
        "NEXT_REDIRECT: /login",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });
  });

  describe("requireRole", () => {
    it("allows authenticated user with matching single role", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: "valid-token" }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      mockExecute.mockResolvedValue(validUser); // role: CUSTOMER

      const user = await requireRole("CUSTOMER");

      expect(user).toEqual(validUser);
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("allows authenticated BARBER for BARBER role check", async () => {
      const barberUser: User = { ...validUser, role: "BARBER" };
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: "valid-token" }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      mockExecute.mockResolvedValue(barberUser);

      const user = await requireRole("BARBER");

      expect(user).toEqual(barberUser);
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("allows authenticated ADMIN for ADMIN role check", async () => {
      const adminUser: User = { ...validUser, role: "ADMIN" };
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: "valid-token" }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      mockExecute.mockResolvedValue(adminUser);

      const user = await requireRole("ADMIN");

      expect(user).toEqual(adminUser);
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("allows user when role matches one of allowed roles array", async () => {
      const adminUser: User = { ...validUser, role: "ADMIN" };
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: "valid-token" }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      mockExecute.mockResolvedValue(adminUser);

      const user = await requireRole(["BARBER", "ADMIN"]);

      expect(user).toEqual(adminUser);
    });

    it("rejects unauthenticated user by redirecting to /login", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      await expect(requireRole("CUSTOMER")).rejects.toThrow(
        "NEXT_REDIRECT: /login",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/login");
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("rejects role mismatch with notFound() by default to prevent leaking route existence", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: "valid-token" }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      mockExecute.mockResolvedValue(validUser); // role: CUSTOMER

      // CUSTOMER trying to access ADMIN route
      await expect(requireRole("ADMIN")).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mockNotFound).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("supports redirect on unauthorized action when configured in options", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: "valid-token" }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      mockExecute.mockResolvedValue(validUser); // role: CUSTOMER

      await expect(
        requireRole("ADMIN", {
          unauthorizedAction: "redirect",
          redirectTo: "/unauthorized",
        }),
      ).rejects.toThrow("NEXT_REDIRECT: /unauthorized");
      expect(mockRedirect).toHaveBeenCalledWith("/unauthorized");
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("rejects inactive user and redirects to /login", async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: "inactive-token" }),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      mockExecute.mockResolvedValue(null);

      await expect(requireRole("CUSTOMER")).rejects.toThrow(
        "NEXT_REDIRECT: /login",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/login");
      expect(mockNotFound).not.toHaveBeenCalled();
    });
  });
});
