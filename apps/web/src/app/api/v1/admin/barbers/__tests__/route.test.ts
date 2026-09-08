import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import {
  BarberUserNotFoundError,
  InvalidBarberRoleError,
  BarberProfileAlreadyExistsError,
} from "@barberkece/core/barber";

const { mockProvisionExecute, mockListExecute } = vi.hoisted(() => ({
  mockProvisionExecute: vi.fn(),
  mockListExecute: vi.fn(),
}));

vi.mock("@barberkece/core/barber", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/barber")>();
  return {
    ...actual,
    ProvisionBarberProfileUseCase: class {
      execute = mockProvisionExecute;
    },
    ListBarbersUseCase: class {
      execute = mockListExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresBarberProfileRepository: vi.fn(),
  PostgresUserRepository: vi.fn(),
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

describe("Admin Barbers Route: /api/v1/admin/barbers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateAdminApi.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", status: "ACTIVE" },
    });
  });

  describe("POST /api/v1/admin/barbers", () => {
    const validUserId = "0191ae5d-8cf7-7b89-9a2c-f604ec20092c";

    it("should return 403 on CSRF mismatch", async () => {
      const req = createJsonRequest(
        "/api/v1/admin/barbers",
        "POST",
        { userId: validUserId },
        {
          origin: "http://bad.com",
        },
      );
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("should return 400 on invalid userId format (not uuid)", async () => {
      const req = createJsonRequest("/api/v1/admin/barbers", "POST", {
        userId: "not-a-uuid",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 404 when user not found (BarberUserNotFoundError)", async () => {
      mockProvisionExecute.mockRejectedValueOnce(
        new BarberUserNotFoundError(validUserId),
      );
      const req = createJsonRequest("/api/v1/admin/barbers", "POST", {
        userId: validUserId,
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("USER_NOT_FOUND");
    });

    it("should return 400 when user role is not BARBER (InvalidBarberRoleError)", async () => {
      mockProvisionExecute.mockRejectedValueOnce(
        new InvalidBarberRoleError(validUserId, "CUSTOMER"),
      );
      const req = createJsonRequest("/api/v1/admin/barbers", "POST", {
        userId: validUserId,
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("INVALID_BARBER_ROLE");
    });

    it("should return 409 when profile already exists (BarberProfileAlreadyExistsError)", async () => {
      mockProvisionExecute.mockRejectedValueOnce(
        new BarberProfileAlreadyExistsError(validUserId),
      );
      const req = createJsonRequest("/api/v1/admin/barbers", "POST", {
        userId: validUserId,
      });
      const res = await POST(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe("BARBER_PROFILE_ALREADY_EXISTS");
    });

    it("should return 201 with AdminBarberDto on success", async () => {
      const now = new Date();
      mockProvisionExecute.mockResolvedValueOnce({
        id: "barber-1",
        userId: validUserId,
        specialization: "Fade Expert",
        createdAt: now,
        updatedAt: now,
      });

      const req = createJsonRequest("/api/v1/admin/barbers", "POST", {
        userId: validUserId,
        specialization: "Fade Expert",
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data).toEqual({
        id: "barber-1",
        userId: validUserId,
        specialization: "Fade Expert",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });
  });

  describe("GET /api/v1/admin/barbers", () => {
    it("should return 200 with list of AdminBarberDto", async () => {
      const now = new Date();
      mockListExecute.mockResolvedValueOnce([
        {
          id: "barber-1",
          userId: "user-1",
          specialization: "Fade",
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].userId).toBe("user-1");
    });
  });
});
