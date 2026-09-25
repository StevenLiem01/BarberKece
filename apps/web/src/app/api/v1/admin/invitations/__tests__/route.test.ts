import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import {
  UserAlreadyExistsError,
} from "@barberkece/core/identity";

const { mockCreateStaffInvitationExecute } = vi.hoisted(() => ({
  mockCreateStaffInvitationExecute: vi.fn(),
}));

vi.mock("@barberkece/core/identity", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/identity")>();
  return {
    ...actual,
    CreateStaffInvitationUseCase: class {
      execute = mockCreateStaffInvitationExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresStaffInvitationRepository: vi.fn(),
  PostgresUserRepository: vi.fn(),
  PostgresStaffInvitationTransactionRunner: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/identity", () => ({
  NodeCryptoTokenAdapter: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/email", () => ({
  ConsoleEmailAdapter: vi.fn(),
}));

vi.mock("@barberkece/config", () => ({
  parseEnv: vi.fn(() => ({ APP_URL: "http://localhost:3000" })),
}));

vi.mock("@/lib/db", () => ({
  getDatabaseClient: vi.fn(() => ({ db: {} })),
}));

vi.mock("@barberkece/infrastructure/logging", () => ({
  generateRequestId: vi.fn(() => "test-req-id"),
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockAuthenticateAdminApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  authenticateAdminApi: mockAuthenticateAdminApi,
}));

function createJsonRequest(
  url: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  const reqHeaders = new Headers({
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "content-type": "application/json",
    ...headers,
  });

  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/v1/admin/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateAdminApi.mockResolvedValue({
      user: { id: "admin-uuid", role: "ADMIN" },
    });
  });

  it("should return 403 on CSRF origin mismatch", async () => {
    const req = createJsonRequest(
      "/api/v1/admin/invitations",
      "POST",
      { displayName: "Budi", email: "budi@example.com", role: "BARBER" },
      { origin: "http://evil.com" },
    );

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("should enforce admin authentication", async () => {
    mockAuthenticateAdminApi.mockResolvedValueOnce({
      response: new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED" } }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    });

    const req = createJsonRequest("/api/v1/admin/invitations", "POST", {
      displayName: "Budi",
      email: "budi@example.com",
      role: "BARBER",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 on malformed JSON body", async () => {
    const req = new NextRequest(
      new URL("/api/v1/admin/invitations", "http://localhost:3000"),
      {
        method: "POST",
        headers: new Headers({
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "content-type": "application/json",
        }),
        body: "{malformed-json",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("MALFORMED_JSON");
  });

  it("should return 400 on validation error (empty displayName)", async () => {
    const req = createJsonRequest("/api/v1/admin/invitations", "POST", {
      displayName: "   ",
      email: "budi@example.com",
      role: "BARBER",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 on validation error (invalid email format)", async () => {
    const req = createJsonRequest("/api/v1/admin/invitations", "POST", {
      displayName: "Budi Santoso",
      email: "not-an-email",
      role: "BARBER",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 on validation error (invalid role)", async () => {
    const req = createJsonRequest("/api/v1/admin/invitations", "POST", {
      displayName: "Budi Santoso",
      email: "budi@example.com",
      role: "CUSTOMER",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 409 if user with email already exists", async () => {
    mockCreateStaffInvitationExecute.mockRejectedValueOnce(
      new UserAlreadyExistsError(),
    );

    const req = createJsonRequest("/api/v1/admin/invitations", "POST", {
      displayName: "Budi Santoso",
      email: "existing@example.com",
      role: "BARBER",
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("USER_ALREADY_EXISTS");
  });

  it("should successfully create invitation and return 201 with public metadata", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 3600 * 1000);

    mockCreateStaffInvitationExecute.mockResolvedValueOnce({
      id: "inv-uuid-1",
      email: "budi@example.com",
      displayName: "Budi Santoso",
      role: "BARBER",
      expiresAt,
      createdAt: now,
    });

    const req = createJsonRequest("/api/v1/admin/invitations", "POST", {
      displayName: "  Budi Santoso  ",
      email: "  Budi@Example.com  ",
      role: "BARBER",
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();

    expect(mockCreateStaffInvitationExecute).toHaveBeenCalledWith({
      displayName: "Budi Santoso",
      email: "budi@example.com",
      role: "BARBER",
    });

    expect(json.data).toEqual({
      id: "inv-uuid-1",
      email: "budi@example.com",
      displayName: "Budi Santoso",
      role: "BARBER",
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    });
    expect(json.data.token).toBeUndefined();
    expect(json.data.tokenHash).toBeUndefined();
  });
});
