import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import {
  InvalidStaffInvitationError,
  StaffInvitationExpiredError,
  StaffInvitationAlreadyUsedError,
  UserAlreadyExistsError,
} from "@barberkece/core/identity";

const { mockAcceptStaffInvitationExecute } = vi.hoisted(() => ({
  mockAcceptStaffInvitationExecute: vi.fn(),
}));

vi.mock("@barberkece/core/identity", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/identity")>();
  return {
    ...actual,
    AcceptStaffInvitationUseCase: class {
      execute = mockAcceptStaffInvitationExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresStaffInvitationTransactionRunner: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/identity", () => ({
  Argon2PasswordHashingAdapter: vi.fn(),
  NodeCryptoTokenAdapter: vi.fn(),
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

describe("POST /api/v1/auth/invitations/[token]/accept", () => {
  const validToken = "secure-invitation-token-123";
  const params = Promise.resolve({ token: validToken });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 403 on CSRF origin mismatch", async () => {
    const req = createJsonRequest(
      `/api/v1/auth/invitations/${validToken}/accept`,
      "POST",
      { password: "StrongPassword123!" },
      { origin: "http://attacker.com" },
    );

    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("should return 400 on malformed JSON", async () => {
    const req = new NextRequest(
      new URL(
        `/api/v1/auth/invitations/${validToken}/accept`,
        "http://localhost:3000",
      ),
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

    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("MALFORMED_JSON");
  });

  it("should return 400 on password shorter than 8 characters", async () => {
    const req = createJsonRequest(
      `/api/v1/auth/invitations/${validToken}/accept`,
      "POST",
      { password: "short" },
    );

    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 on missing password", async () => {
    const req = createJsonRequest(
      `/api/v1/auth/invitations/${validToken}/accept`,
      "POST",
      {},
    );

    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 on empty password", async () => {
    const req = createJsonRequest(
      `/api/v1/auth/invitations/${validToken}/accept`,
      "POST",
      { password: "" },
    );

    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 on empty token param", async () => {
    const req = createJsonRequest(
      "/api/v1/auth/invitations//accept",
      "POST",
      { password: "StrongPassword123!" },
    );

    const res = await POST(req, { params: Promise.resolve({ token: "" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_INVITATION_TOKEN");
  });

  it("should return 404 if invitation token is not found", async () => {
    mockAcceptStaffInvitationExecute.mockRejectedValueOnce(
      new InvalidStaffInvitationError(),
    );

    const req = createJsonRequest(
      `/api/v1/auth/invitations/${validToken}/accept`,
      "POST",
      { password: "StrongPassword123!" },
    );

    const res = await POST(req, { params });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_INVITATION_TOKEN");
  });

  it("should return 410 if invitation token is expired", async () => {
    mockAcceptStaffInvitationExecute.mockRejectedValueOnce(
      new StaffInvitationExpiredError(),
    );

    const req = createJsonRequest(
      `/api/v1/auth/invitations/${validToken}/accept`,
      "POST",
      { password: "StrongPassword123!" },
    );

    const res = await POST(req, { params });
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error.code).toBe("INVITATION_EXPIRED");
  });

  it("should return 400 if invitation token has already been used", async () => {
    mockAcceptStaffInvitationExecute.mockRejectedValueOnce(
      new StaffInvitationAlreadyUsedError(),
    );

    const req = createJsonRequest(
      `/api/v1/auth/invitations/${validToken}/accept`,
      "POST",
      { password: "StrongPassword123!" },
    );

    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVITATION_ALREADY_USED");
  });

  it("should return 409 if user with email already exists", async () => {
    mockAcceptStaffInvitationExecute.mockRejectedValueOnce(
      new UserAlreadyExistsError(),
    );

    const req = createJsonRequest(
      `/api/v1/auth/invitations/${validToken}/accept`,
      "POST",
      { password: "StrongPassword123!" },
    );

    const res = await POST(req, { params });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("USER_ALREADY_EXISTS");
  });

  it("should successfully accept invitation and return 201 on success", async () => {
    mockAcceptStaffInvitationExecute.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "staff@barberkece.id",
        displayName: "Ahmad Fauzi",
        role: "BARBER",
      },
    });

    const req = createJsonRequest(
      `/api/v1/auth/invitations/${validToken}/accept`,
      "POST",
      { password: "StrongPassword123!" },
    );

    const res = await POST(req, { params });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toEqual({
      message: "Akun berhasil dibuat. Silakan masuk.",
      email: "staff@barberkece.id",
      role: "BARBER",
    });

    expect(mockAcceptStaffInvitationExecute).toHaveBeenCalledWith({
      token: validToken,
      passwordRaw: "StrongPassword123!",
    });
  });
});
