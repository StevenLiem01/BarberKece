import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { IdentityError } from "@barberkece/core/identity";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock("@barberkece/core/identity", () => {
  return {
    IdentityError: class extends Error {
      constructor(message: string) {
        super(message);
        this.name = "IdentityError";
      }
    },
    ResetPasswordUseCase: class {
      execute = mockExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresPasswordResetTransactionRunner: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/identity", () => ({
  Argon2PasswordHashingAdapter: vi.fn(),
  NodeCryptoTokenAdapter: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/logging", () => ({
  generateRequestId: vi.fn(() => "test-req-id"),
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  getDatabaseClient: vi.fn(() => ({ db: {} })),
}));

describe("POST /api/v1/auth/password-reset/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (
    body: Record<string, unknown> | null,
    options?: {
      origin?: string;
      referer?: string;
      host?: string;
      omitOrigin?: boolean;
    },
  ) => {
    const headers = new Headers();
    const host = options?.host ?? "localhost:3000";
    headers.set("host", host);

    if (!options?.omitOrigin) {
      headers.set("origin", options?.origin ?? `http://${host}`);
    }

    if (options?.referer) {
      headers.set("referer", options?.referer);
    }

    if (body !== null) {
      headers.set("content-type", "application/json");
      return new NextRequest(
        "http://localhost:3000/api/v1/auth/password-reset/confirm",
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        },
      );
    }

    return new NextRequest(
      "http://localhost:3000/api/v1/auth/password-reset/confirm",
      {
        method: "POST",
        headers,
      },
    );
  };

  it("should allow request with matching origin, reset password, and NOT set any session cookie", async () => {
    mockExecute.mockResolvedValueOnce({
      message:
        "Password has been reset successfully. Please log in with your new password.",
    });

    const req = createRequest({
      token: "valid-raw-token",
      newPassword: "NewSecurePassword123",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      data: {
        message:
          "Password has been reset successfully. Please log in with your new password.",
      },
    });

    // Invariant: Must NOT set auth session cookie after reset; user must log in explicitly
    expect(res.cookies.get("barberkece_session")).toBeUndefined();
    expect(mockExecute).toHaveBeenCalledWith({
      token: "valid-raw-token",
      newPassword: "NewSecurePassword123",
    });
  });

  it("should allow request with missing origin but matching referer", async () => {
    mockExecute.mockResolvedValueOnce({
      message:
        "Password has been reset successfully. Please log in with your new password.",
    });

    const req = createRequest(
      {
        token: "valid-raw-token",
        newPassword: "NewSecurePassword123",
      },
      { omitOrigin: true, referer: "http://localhost:3000/reset-password" },
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("should reject request when both origin and referer are absent (fail-closed CSRF)", async () => {
    const req = createRequest(
      {
        token: "valid-raw-token",
        newPassword: "NewSecurePassword123",
      },
      { omitOrigin: true },
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("should reject cross-origin request with mismatched origin", async () => {
    const req = createRequest(
      {
        token: "valid-raw-token",
        newPassword: "NewSecurePassword123",
      },
      { origin: "http://attacker.com" },
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("should reject malformed JSON with 400 MALFORMED_JSON", async () => {
    const headers = new Headers();
    headers.set("host", "localhost:3000");
    headers.set("origin", "http://localhost:3000");
    headers.set("content-type", "application/json");

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/password-reset/confirm",
      {
        method: "POST",
        headers,
        body: "invalid-json{",
      },
    );

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("MALFORMED_JSON");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("should reject validation error when token is missing", async () => {
    const req = createRequest({ newPassword: "NewSecurePassword123" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("should reject validation error when password is less than 8 characters", async () => {
    const req = createRequest({
      token: "valid-token",
      newPassword: "short",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("should return 400 INVALID_RESET_TOKEN when token is invalid, expired, or already used", async () => {
    mockExecute.mockRejectedValueOnce(
      new IdentityError("Invalid or expired password reset token"),
    );

    const req = createRequest({
      token: "invalid-token",
      newPassword: "NewSecurePassword123",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("INVALID_RESET_TOKEN");
    expect(json.error.message).toBe("Invalid or expired password reset token");
    expect(json.error.requestId).toBe("test-req-id");
  });

  it("should return 500 INTERNAL_SERVER_ERROR on unexpected failure", async () => {
    mockExecute.mockRejectedValueOnce(new Error("Unexpected failure"));

    const req = createRequest({
      token: "valid-token",
      newPassword: "NewSecurePassword123",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(json.error.requestId).toBe("test-req-id");
  });
});
