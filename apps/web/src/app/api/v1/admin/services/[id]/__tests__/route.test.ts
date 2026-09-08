import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";
import { ServiceNotFoundError } from "@barberkece/core/reservation";

const { mockGetExecute, mockUpdateExecute } = vi.hoisted(() => ({
  mockGetExecute: vi.fn(),
  mockUpdateExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    GetServiceUseCase: class {
      execute = mockGetExecute;
    },
    UpdateServiceUseCase: class {
      execute = mockUpdateExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresServiceRepository: vi.fn(),
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

describe("Admin Service Detail Route: /api/v1/admin/services/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateAdminApi.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", status: "ACTIVE" },
    });
  });

  describe("GET /api/v1/admin/services/[id]", () => {
    it("should return 401 if unauthenticated", async () => {
      mockAuthenticateAdminApi.mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({ error: { code: "UNAUTHORIZED" } }),
          { status: 401 },
        ),
      });
      const req = createJsonRequest("/api/v1/admin/services/srv-1", "GET");
      const res = await GET(req, { params: Promise.resolve({ id: "srv-1" }) });
      expect(res.status).toBe(401);
    });

    it("should return 404 if service not found", async () => {
      mockGetExecute.mockRejectedValueOnce(
        new ServiceNotFoundError("srv-unknown"),
      );
      const req = createJsonRequest(
        "/api/v1/admin/services/srv-unknown",
        "GET",
      );
      const res = await GET(req, {
        params: Promise.resolve({ id: "srv-unknown" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("SERVICE_NOT_FOUND");
    });

    it("should return 200 with service even if inactive (activeOnly: false)", async () => {
      const now = new Date();
      mockGetExecute.mockResolvedValueOnce({
        id: "srv-1",
        name: "Inactive Service",
        durationMinutes: 30,
        priceRupiah: 40000,
        description: null,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });

      const req = createJsonRequest("/api/v1/admin/services/srv-1", "GET");
      const res = await GET(req, { params: Promise.resolve({ id: "srv-1" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.isActive).toBe(false);
      expect(mockGetExecute).toHaveBeenCalledWith("srv-1", {
        activeOnly: false,
      });
    });
  });

  describe("PATCH /api/v1/admin/services/[id]", () => {
    it("should return 403 on CSRF origin mismatch", async () => {
      const req = createJsonRequest(
        "/api/v1/admin/services/srv-1",
        "PATCH",
        { name: "Updated" },
        {
          origin: "http://attacker.com",
        },
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "srv-1" }),
      });
      expect(res.status).toBe(403);
    });

    it("should return 400 on validation failure", async () => {
      const req = createJsonRequest("/api/v1/admin/services/srv-1", "PATCH", {
        durationMinutes: 0, // must be positive
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "srv-1" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 404 if updating non-existent service", async () => {
      mockUpdateExecute.mockRejectedValueOnce(
        new ServiceNotFoundError("srv-unknown"),
      );
      const req = createJsonRequest(
        "/api/v1/admin/services/srv-unknown",
        "PATCH",
        {
          name: "New Name",
        },
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "srv-unknown" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("SERVICE_NOT_FOUND");
    });

    it("should return 200 with updated service", async () => {
      const now = new Date();
      mockUpdateExecute.mockResolvedValueOnce({
        id: "srv-1",
        name: "Updated Cut",
        durationMinutes: 40,
        priceRupiah: 60000,
        description: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const req = createJsonRequest("/api/v1/admin/services/srv-1", "PATCH", {
        name: "Updated Cut",
        durationMinutes: 40,
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "srv-1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.name).toBe("Updated Cut");
    });
  });
});
