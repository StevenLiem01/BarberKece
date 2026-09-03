import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { AuthenticationError } from "@barberkece/core/identity";

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
    AuthenticationError: class extends Error {
      constructor(message: string) {
        super(message);
        this.name = "AuthenticationError";
      }
    },
    AuthenticateUserUseCase: class {
      execute = mockExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresUserRepository: vi.fn(),
  PostgresSessionRepository: vi.fn(),
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

const mockParseEnv = vi.hoisted(() => vi.fn());
vi.mock("@barberkece/config", () => ({
  parseEnv: mockParseEnv,
}));

describe("POST /api/v1/auth/login", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockParseEnv.mockReturnValue({ NODE_ENV: "development" });
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
    if (host) {
      headers.set("host", host);
    }

    if (options?.origin) {
      headers.set("origin", options.origin);
    } else if (!options?.omitOrigin && !options?.referer) {
      headers.set("origin", "http://localhost:3000");
    }

    if (options?.referer !== undefined) {
      headers.set("referer", options.referer);
    }

    return new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : null,
    });
  };

  it("should successfully login a customer and set secure cookie", async () => {
    const expiresAt = new Date("2030-01-01T00:00:00Z");
    mockExecute.mockResolvedValue({
      user: {
        id: "user-123",
        email: "test@example.com",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
      rawToken: "my-secure-token",
      expiresAt,
    });

    const req = createRequest({
      email: "test@example.com",
      password: "password123",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.id).toBe("user-123");
    expect(data.data.role).toBe("CUSTOMER");
    expect(data.data.passwordHash).toBeUndefined();
    expect(data.data.tokenHash).toBeUndefined();
    expect(data.rawToken).toBeUndefined();

    // Check cookies
    const cookieHeader = res.headers.get("Set-Cookie");
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain("barberkece_session=my-secure-token");
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("SameSite=lax");
    expect(cookieHeader).toContain("Path=/");
    expect(cookieHeader).toContain("Max-Age=604800");
    // Secure flag is omitted or false in dev by default, nextjs Set-Cookie parses it.
    // However, if we mock production:
  });

  it("should set Secure=true cookie in production", async () => {
    mockParseEnv.mockReturnValue({ NODE_ENV: "production" });
    const expiresAt = new Date("2030-01-01T00:00:00Z");
    mockExecute.mockResolvedValue({
      user: { id: "user-123" },
      rawToken: "token",
      expiresAt,
    });

    const req = createRequest({ email: "t@t.com", password: "p" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const cookieHeader = res.headers.get("Set-Cookie");
    expect(cookieHeader).toContain("Secure");
  });

  it("should return 400 on malformed JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: new Headers({
        origin: "http://localhost:3000",
        host: "localhost:3000",
      }),
      body: "{ bad json ",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("MALFORMED_JSON");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("should return 400 on invalid input", async () => {
    const req = createRequest({ email: "not-an-email", password: "" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("should return 401 enumeration-safe on auth failure", async () => {
    mockExecute.mockRejectedValue(
      new AuthenticationError("Invalid email or password"),
    );

    const req = createRequest({ email: "fail@t.com", password: "p" });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe("AUTHENTICATION_FAILED");
    expect(data.error.message).toBe("Invalid email or password");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("should mask unexpected errors as 500", async () => {
    mockExecute.mockRejectedValue(new Error("Database exploded"));

    const req = createRequest({ email: "error@t.com", password: "p" });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  describe("same-origin CSRF protection", () => {
    it("rejects cross-origin requests when Origin does not match Host", async () => {
      const req = createRequest(
        { email: "test@example.com", password: "password123" },
        {
          origin: "https://malicious-site.com",
          host: "localhost:3000",
        },
      );
      const res = await POST(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("FORBIDDEN");
      expect(data.error.message).toBe("Cross-origin request forbidden");
      expect(data.error.requestId).toBe("test-req-id");
      expect(mockExecute).not.toHaveBeenCalled();
      expect(res.headers.get("Set-Cookie")).toBeNull();
    });

    it("rejects cross-origin requests when Referer does not match Host and Origin is absent", async () => {
      const req = createRequest(
        { email: "test@example.com", password: "password123" },
        {
          referer: "https://malicious-site.com/phish",
          host: "localhost:3000",
        },
      );
      const res = await POST(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("FORBIDDEN");
      expect(data.error.message).toBe("Cross-origin request forbidden");
      expect(data.error.requestId).toBe("test-req-id");
      expect(mockExecute).not.toHaveBeenCalled();
      expect(res.headers.get("Set-Cookie")).toBeNull();
    });

    it("rejects malformed Origin header", async () => {
      const req = createRequest(
        { email: "test@example.com", password: "password123" },
        {
          origin: "not-a-valid-url",
          host: "localhost:3000",
        },
      );
      const res = await POST(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("FORBIDDEN");
      expect(data.error.message).toBe("Invalid origin header");
      expect(data.error.requestId).toBe("test-req-id");
      expect(mockExecute).not.toHaveBeenCalled();
      expect(res.headers.get("Set-Cookie")).toBeNull();
    });

    it("rejects malformed Referer header when Origin is absent", async () => {
      const req = createRequest(
        { email: "test@example.com", password: "password123" },
        {
          referer: "not-a-valid-url",
          host: "localhost:3000",
        },
      );
      const res = await POST(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("FORBIDDEN");
      expect(data.error.message).toBe("Invalid referer header");
      expect(data.error.requestId).toBe("test-req-id");
      expect(mockExecute).not.toHaveBeenCalled();
      expect(res.headers.get("Set-Cookie")).toBeNull();
    });

    it("allows same-origin requests with matching Origin header", async () => {
      const expiresAt = new Date("2030-01-01T00:00:00Z");
      mockExecute.mockResolvedValue({
        user: { id: "user-123" },
        rawToken: "token",
        expiresAt,
      });

      const req = createRequest(
        { email: "test@example.com", password: "password123" },
        {
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
      );
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockExecute).toHaveBeenCalled();
      expect(res.headers.get("Set-Cookie")).toContain(
        "barberkece_session=token",
      );
    });

    it("allows same-origin requests with matching Referer header when Origin is absent", async () => {
      const expiresAt = new Date("2030-01-01T00:00:00Z");
      mockExecute.mockResolvedValue({
        user: { id: "user-123" },
        rawToken: "token",
        expiresAt,
      });

      const req = createRequest(
        { email: "test@example.com", password: "password123" },
        {
          referer: "http://localhost:3000/login",
          host: "localhost:3000",
        },
      );
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockExecute).toHaveBeenCalled();
      expect(res.headers.get("Set-Cookie")).toContain(
        "barberkece_session=token",
      );
    });

    it("gives Origin precedence over Referer", async () => {
      const expiresAt = new Date("2030-01-01T00:00:00Z");
      mockExecute.mockResolvedValue({
        user: { id: "user-123" },
        rawToken: "token",
        expiresAt,
      });

      const req = createRequest(
        { email: "test@example.com", password: "password123" },
        {
          origin: "http://localhost:3000",
          referer: "https://evil.com/attacker",
          host: "localhost:3000",
        },
      );
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockExecute).toHaveBeenCalled();
      expect(res.headers.get("Set-Cookie")).toContain(
        "barberkece_session=token",
      );
    });

    it("rejects request when both Origin and Referer headers are absent", async () => {
      const req = createRequest(
        { email: "test@example.com", password: "password123" },
        {
          omitOrigin: true,
          host: "localhost:3000",
        },
      );
      const res = await POST(req);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("FORBIDDEN");
      expect(data.error.message).toBe("Cross-origin request forbidden");
      expect(data.error.requestId).toBe("test-req-id");
      expect(mockExecute).not.toHaveBeenCalled();
      expect(res.headers.get("Set-Cookie")).toBeNull();
    });
  });
});
