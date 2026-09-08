import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import { ServiceNotFoundError } from "@barberkece/core/reservation";
import { BarberProfileNotFoundError } from "@barberkece/core/barber";

const { mockAssignExecute, mockGetEligibleExecute } = vi.hoisted(() => ({
  mockAssignExecute: vi.fn(),
  mockGetEligibleExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    AssignServiceToBarberUseCase: class {
      execute = mockAssignExecute;
    },
    GetBarberEligibleServicesUseCase: class {
      execute = mockGetEligibleExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresBarberEligibilityRepository: vi.fn(),
  PostgresServiceRepository: vi.fn(),
  PostgresBarberProfileRepository: vi.fn(),
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

describe("Admin Barber Services Route: /api/v1/admin/barbers/[id]/services", () => {
  const validServiceId = "0191ae5d-8cf7-7b89-9a2c-f604ec20092c";

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateAdminApi.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", status: "ACTIVE" },
    });
  });

  describe("POST /api/v1/admin/barbers/[id]/services", () => {
    it("should return 403 on CSRF mismatch", async () => {
      const req = createJsonRequest(
        "/api/v1/admin/barbers/b-1/services",
        "POST",
        { serviceId: validServiceId },
        {
          origin: "http://malicious.com",
        },
      );
      const res = await POST(req, { params: Promise.resolve({ id: "b-1" }) });
      expect(res.status).toBe(403);
    });

    it("should return 400 on invalid serviceId format", async () => {
      const req = createJsonRequest(
        "/api/v1/admin/barbers/b-1/services",
        "POST",
        { serviceId: "not-uuid" },
      );
      const res = await POST(req, { params: Promise.resolve({ id: "b-1" }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 404 if barber profile not found", async () => {
      mockAssignExecute.mockRejectedValueOnce(
        new BarberProfileNotFoundError("b-unknown"),
      );
      const req = createJsonRequest(
        "/api/v1/admin/barbers/b-unknown/services",
        "POST",
        { serviceId: validServiceId },
      );
      const res = await POST(req, {
        params: Promise.resolve({ id: "b-unknown" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
    });

    it("should return 404 if service not found", async () => {
      mockAssignExecute.mockRejectedValueOnce(
        new ServiceNotFoundError(validServiceId),
      );
      const req = createJsonRequest(
        "/api/v1/admin/barbers/b-1/services",
        "POST",
        { serviceId: validServiceId },
      );
      const res = await POST(req, { params: Promise.resolve({ id: "b-1" }) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("SERVICE_NOT_FOUND");
    });

    it("should return 200 OK (idempotent assign) on success", async () => {
      mockAssignExecute.mockResolvedValueOnce(undefined);
      const req = createJsonRequest(
        "/api/v1/admin/barbers/b-1/services",
        "POST",
        { serviceId: validServiceId },
      );
      const res = await POST(req, { params: Promise.resolve({ id: "b-1" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual({
        barberId: "b-1",
        serviceId: validServiceId,
      });
    });
  });

  describe("GET /api/v1/admin/barbers/[id]/services", () => {
    it("should return 404 if barber profile not found", async () => {
      mockGetEligibleExecute.mockRejectedValueOnce(
        new BarberProfileNotFoundError("b-unknown"),
      );
      const req = createJsonRequest(
        "/api/v1/admin/barbers/b-unknown/services",
        "GET",
      );
      const res = await GET(req, {
        params: Promise.resolve({ id: "b-unknown" }),
      });
      expect(res.status).toBe(404);
    });

    it("should return 200 with all eligible services (activeOnly: false)", async () => {
      const now = new Date();
      mockGetEligibleExecute.mockResolvedValueOnce([
        {
          id: validServiceId,
          name: "Fade",
          durationMinutes: 30,
          priceRupiah: 50000,
          description: null,
          isActive: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const req = createJsonRequest(
        "/api/v1/admin/barbers/b-1/services",
        "GET",
      );
      const res = await GET(req, { params: Promise.resolve({ id: "b-1" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].isActive).toBe(false);
      expect(mockGetEligibleExecute).toHaveBeenCalledWith({
        barberProfileId: "b-1",
        activeOnly: false,
      });
    });
  });
});
