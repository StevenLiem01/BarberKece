import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

const { mockValidateStaffInvitationExecute } = vi.hoisted(() => ({
  mockValidateStaffInvitationExecute: vi.fn(),
}));

vi.mock("@barberkece/core/identity", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/identity")>();
  return {
    ...actual,
    ValidateStaffInvitationUseCase: class {
      execute = mockValidateStaffInvitationExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresStaffInvitationRepository: vi.fn(),
  PostgresUserRepository: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/identity", () => ({
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

describe("GET /api/v1/auth/invitations/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 if token is not found", async () => {
    mockValidateStaffInvitationExecute.mockResolvedValueOnce({
      isValid: false,
      reason: "NOT_FOUND",
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invitations/invalid-token",
    );
    const res = await GET(req, {
      params: Promise.resolve({ token: "invalid-token" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("INVITATION_NOT_FOUND");
  });

  it("should return 410 if invitation has expired", async () => {
    mockValidateStaffInvitationExecute.mockResolvedValueOnce({
      isValid: false,
      reason: "EXPIRED",
      email: "budi@example.com",
      displayName: "Budi Santoso",
      role: "BARBER",
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invitations/expired-token",
    );
    const res = await GET(req, {
      params: Promise.resolve({ token: "expired-token" }),
    });

    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error.code).toBe("INVITATION_EXPIRED");
    expect(json.data.isValid).toBe(false);
  });

  it("should return 400 if invitation has already been used", async () => {
    mockValidateStaffInvitationExecute.mockResolvedValueOnce({
      isValid: false,
      reason: "USED",
      email: "budi@example.com",
      displayName: "Budi Santoso",
      role: "BARBER",
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invitations/used-token",
    );
    const res = await GET(req, {
      params: Promise.resolve({ token: "used-token" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVITATION_ALREADY_USED");
  });

  it("should return 409 if user with email already exists", async () => {
    mockValidateStaffInvitationExecute.mockResolvedValueOnce({
      isValid: false,
      reason: "USER_ALREADY_EXISTS",
      email: "budi@example.com",
      displayName: "Budi Santoso",
      role: "BARBER",
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invitations/user-exists-token",
    );
    const res = await GET(req, {
      params: Promise.resolve({ token: "user-exists-token" }),
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("USER_ALREADY_EXISTS");
  });

  it("should return 200 with staff invitation public metadata if valid", async () => {
    mockValidateStaffInvitationExecute.mockResolvedValueOnce({
      isValid: true,
      email: "budi@example.com",
      displayName: "Budi Santoso",
      role: "BARBER",
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/auth/invitations/valid-token",
    );
    const res = await GET(req, {
      params: Promise.resolve({ token: "valid-token" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({
      isValid: true,
      email: "budi@example.com",
      displayName: "Budi Santoso",
      role: "BARBER",
    });
  });
});
