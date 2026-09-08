import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import { ReservationError } from "@barberkece/core/reservation";

const { mockCreateExecute, mockListExecute } = vi.hoisted(() => ({
  mockCreateExecute: vi.fn(),
  mockListExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    CreateServiceUseCase: class {
      execute = mockCreateExecute;
    },
    ListServicesUseCase: class {
      execute = mockListExecute;
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

describe("Admin Services Route: /api/v1/admin/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateAdminApi.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", status: "ACTIVE" },
    });
  });

  describe("POST /api/v1/admin/services", () => {
    it("should return 403 on CSRF origin mismatch", async () => {
      const req = createJsonRequest(
        "/api/v1/admin/services",
        "POST",
        { name: "Haircut" },
        {
          origin: "http://evil.com",
        },
      );
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("should return 401 if unauthenticated", async () => {
      mockAuthenticateAdminApi.mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({
            error: {
              code: "UNAUTHORIZED",
              message: "Auth required",
              requestId: "test-req-id",
            },
          }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      });

      const req = createJsonRequest("/api/v1/admin/services", "POST", {
        name: "Haircut",
        durationMinutes: 30,
        priceRupiah: 50000,
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 if not admin", async () => {
      mockAuthenticateAdminApi.mockResolvedValueOnce({
        response: new Response(
          JSON.stringify({
            error: {
              code: "FORBIDDEN",
              message: "Admin role required",
              requestId: "test-req-id",
            },
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      });

      const req = createJsonRequest("/api/v1/admin/services", "POST", {
        name: "Haircut",
        durationMinutes: 30,
        priceRupiah: 50000,
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("should return 400 on invalid JSON body", async () => {
      const req = new NextRequest(
        new URL("/api/v1/admin/services", "http://localhost:3000"),
        {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            "content-type": "application/json",
          },
          body: "invalid-json{",
        },
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("INVALID_JSON");
    });

    it("should return 400 on validation failure (negative duration, missing name)", async () => {
      const req = createJsonRequest("/api/v1/admin/services", "POST", {
        name: "",
        durationMinutes: -5,
        priceRupiah: -100,
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 on domain ReservationError", async () => {
      mockCreateExecute.mockRejectedValueOnce(
        new ReservationError("Domain validation failed"),
      );

      const req = createJsonRequest("/api/v1/admin/services", "POST", {
        name: "Haircut",
        durationMinutes: 30,
        priceRupiah: 50000,
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toBe("Domain validation failed");
    });

    it("should return 201 with AdminServiceDto on success", async () => {
      const now = new Date();
      mockCreateExecute.mockResolvedValueOnce({
        id: "srv-1",
        name: "Classic Cut",
        durationMinutes: 45,
        priceRupiah: 75000,
        description: "Standard cut",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const req = createJsonRequest("/api/v1/admin/services", "POST", {
        name: "Classic Cut",
        durationMinutes: 45,
        priceRupiah: 75000,
        description: "Standard cut",
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data).toEqual({
        id: "srv-1",
        name: "Classic Cut",
        durationMinutes: 45,
        priceRupiah: 75000,
        description: "Standard cut",
        isActive: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });
  });

  describe("GET /api/v1/admin/services", () => {
    it("should return 200 with all services including inactive", async () => {
      const now = new Date();
      mockListExecute.mockResolvedValueOnce([
        {
          id: "srv-1",
          name: "Active Cut",
          durationMinutes: 30,
          priceRupiah: 50000,
          description: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "srv-2",
          name: "Inactive Cut",
          durationMinutes: 60,
          priceRupiah: 100000,
          description: "Deprecated",
          isActive: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(2);
      expect(json.data[0].isActive).toBe(true);
      expect(json.data[1].isActive).toBe(false);
      expect(mockListExecute).toHaveBeenCalledWith("all");
    });
  });
});
