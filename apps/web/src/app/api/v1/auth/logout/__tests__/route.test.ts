import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock("@barberkece/core/identity", () => ({
  RevokeSessionUseCase: class {
    execute = mockExecute;
  },
}));

vi.mock("@barberkece/database/repositories", () => ({
  PostgresSessionRepository: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/identity", () => ({
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

describe("POST /api/v1/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseEnv.mockReturnValue({ NODE_ENV: "development" });
  });

  const createRequest = (options?: {
    cookie?: string;
    origin?: string;
    referer?: string;
    host?: string;
  }) => {
    const headers = new Headers();
    if (options?.cookie) {
      headers.set("cookie", options.cookie);
    }
    if (options?.origin) {
      headers.set("origin", options.origin);
    }
    if (options?.referer) {
      headers.set("referer", options.referer);
    }
    if (options?.host) {
      headers.set("host", options.host);
    }

    return new NextRequest("http://localhost:3000/api/v1/auth/logout", {
      method: "POST",
      headers,
    });
  };

  it("successfully revokes session, clears cookie, and returns 200", async () => {
    mockExecute.mockResolvedValue(undefined);

    const rawToken = "my-secret-session-token";
    const req = createRequest({
      cookie: `barberkece_session=${rawToken}`,
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: { success: true } });
    expect(mockExecute).toHaveBeenCalledWith(rawToken);

    // Verify raw token is absent from JSON response
    expect(JSON.stringify(body)).not.toContain(rawToken);

    // Verify Set-Cookie header clears the cookie
    const cookieHeader = res.headers.get("Set-Cookie");
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain("barberkece_session=");
    expect(cookieHeader).toContain("Max-Age=0");
    expect(cookieHeader).toContain("Path=/");
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("SameSite=lax");
    expect(cookieHeader).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });

  it("succeeds and clears cookie even when session cookie is missing", async () => {
    const req = createRequest();
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: { success: true } });
    expect(mockExecute).not.toHaveBeenCalled();

    const cookieHeader = res.headers.get("Set-Cookie");
    expect(cookieHeader).toContain("barberkece_session=");
    expect(cookieHeader).toContain("Max-Age=0");
  });

  it("does not disclose whether session was already invalid or nonexistent", async () => {
    mockExecute.mockResolvedValue(undefined);

    const req = createRequest({
      cookie: "barberkece_session=already-invalid-token",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: { success: true } });
  });

  it("sets Secure=true on cleared cookie in production", async () => {
    mockParseEnv.mockReturnValue({ NODE_ENV: "production" });
    mockExecute.mockResolvedValue(undefined);

    const req = createRequest({
      cookie: "barberkece_session=sample-token",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const cookieHeader = res.headers.get("Set-Cookie");
    expect(cookieHeader).toContain("Secure");
  });

  it("returns safe 500 with requestId on unexpected dependency error", async () => {
    const rawToken = "sensitive-raw-token-999";
    mockExecute.mockRejectedValue(new Error("Postgres connection failure"));

    const req = createRequest({
      cookie: `barberkece_session=${rawToken}`,
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      requestId: "test-req-id",
    });

    // Ensure raw token is never exposed in response
    expect(JSON.stringify(body)).not.toContain(rawToken);
  });

  it("rejects cross-origin requests when Origin does not match Host", async () => {
    const req = createRequest({
      cookie: "barberkece_session=test-token",
      origin: "https://malicious-site.com",
      host: "localhost:3000",
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.requestId).toBe("test-req-id");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests when Referer does not match Host and Origin is absent", async () => {
    const req = createRequest({
      cookie: "barberkece_session=test-token",
      referer: "https://malicious-site.com/attack",
      host: "localhost:3000",
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.requestId).toBe("test-req-id");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("allows same-origin requests with matching Origin header", async () => {
    mockExecute.mockResolvedValue(undefined);

    const req = createRequest({
      cookie: "barberkece_session=valid-token",
      origin: "http://localhost:3000",
      host: "localhost:3000",
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockExecute).toHaveBeenCalledWith("valid-token");
  });
});
