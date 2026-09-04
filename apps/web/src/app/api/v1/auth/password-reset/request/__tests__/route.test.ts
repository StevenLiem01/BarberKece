import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

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
    RequestPasswordResetUseCase: class {
      execute = mockExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresUserRepository: vi.fn(),
  PostgresPasswordResetTransactionRunner: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/identity", () => ({
  NodeCryptoTokenAdapter: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/email", () => ({
  ConsoleEmailAdapter: vi.fn(),
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

vi.mock("@barberkece/config", () => ({
  parseEnv: vi.fn(() => ({
    APP_URL: "https://barberkece.id",
    NODE_ENV: "test",
  })),
}));

describe("POST /api/v1/auth/password-reset/request", () => {
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
        "http://localhost:3000/api/v1/auth/password-reset/request",
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        },
      );
    }

    return new NextRequest(
      "http://localhost:3000/api/v1/auth/password-reset/request",
      {
        method: "POST",
        headers,
      },
    );
  };

  it("should allow request with matching origin and return generic 200 response", async () => {
    mockExecute.mockResolvedValueOnce({
      message:
        "If your email is registered, you will receive password reset instructions shortly.",
    });

    const req = createRequest({ email: "customer@example.com" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      data: {
        message:
          "If your email is registered, you will receive password reset instructions shortly.",
      },
    });
    expect(json.data).not.toHaveProperty("token");
    expect(json.data).not.toHaveProperty("rawToken");
  });

  it("should allow request with missing origin but matching referer", async () => {
    mockExecute.mockResolvedValueOnce({
      message:
        "If your email is registered, you will receive password reset instructions shortly.",
    });

    const req = createRequest(
      { email: "customer@example.com" },
      { omitOrigin: true, referer: "http://localhost:3000/reset-password" },
    );
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.message).toBeDefined();
  });

  it("should reject request when both origin and referer are absent (fail-closed CSRF)", async () => {
    const req = createRequest(
      { email: "customer@example.com" },
      { omitOrigin: true },
    );
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error.code).toBe("FORBIDDEN");
    expect(json.error.requestId).toBe("test-req-id");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("should reject cross-origin request with mismatched origin", async () => {
    const req = createRequest(
      { email: "customer@example.com" },
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
      "http://localhost:3000/api/v1/auth/password-reset/request",
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
    expect(json.error.requestId).toBe("test-req-id");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("should reject request with invalid email format", async () => {
    const req = createRequest({ email: "invalid-email-format" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.requestId).toBe("test-req-id");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("should reject request with missing email", async () => {
    const req = createRequest({});
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("should return 500 INTERNAL_SERVER_ERROR on unexpected failure", async () => {
    mockExecute.mockRejectedValueOnce(new Error("Unexpected DB crash"));

    const req = createRequest({ email: "customer@example.com" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(json.error.requestId).toBe("test-req-id");
  });
});
