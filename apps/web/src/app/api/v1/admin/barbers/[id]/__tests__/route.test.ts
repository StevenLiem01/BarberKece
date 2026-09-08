import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";
import { BarberProfileNotFoundError } from "@barberkece/core/barber";

const { mockGetExecute, mockUpdateExecute } = vi.hoisted(() => ({
  mockGetExecute: vi.fn(),
  mockUpdateExecute: vi.fn(),
}));

vi.mock("@barberkece/core/barber", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/barber")>();
  return {
    ...actual,
    GetBarberProfileUseCase: class {
      execute = mockGetExecute;
    },
    UpdateBarberProfileUseCase: class {
      execute = mockUpdateExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
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

describe("Admin Barber Detail Route: /api/v1/admin/barbers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateAdminApi.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", status: "ACTIVE" },
    });
  });

  describe("GET /api/v1/admin/barbers/[id]", () => {
    it("should return 404 if barber profile not found", async () => {
      mockGetExecute.mockRejectedValueOnce(
        new BarberProfileNotFoundError("barber-unknown"),
      );
      const req = createJsonRequest(
        "/api/v1/admin/barbers/barber-unknown",
        "GET",
      );
      const res = await GET(req, {
        params: Promise.resolve({ id: "barber-unknown" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
    });

    it("should return 200 with AdminBarberDto", async () => {
      const now = new Date();
      mockGetExecute.mockResolvedValueOnce({
        id: "barber-1",
        userId: "user-1",
        specialization: "Fade",
        createdAt: now,
        updatedAt: now,
      });

      const req = createJsonRequest("/api/v1/admin/barbers/barber-1", "GET");
      const res = await GET(req, {
        params: Promise.resolve({ id: "barber-1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual({
        id: "barber-1",
        userId: "user-1",
        specialization: "Fade",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    });
  });

  describe("PATCH /api/v1/admin/barbers/[id]", () => {
    it("should return 403 on CSRF mismatch", async () => {
      const req = createJsonRequest(
        "/api/v1/admin/barbers/barber-1",
        "PATCH",
        { specialization: "Scissor" },
        {
          origin: "http://hacker.com",
        },
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "barber-1" }),
      });
      expect(res.status).toBe(403);
    });

    it("should return 404 if barber profile not found", async () => {
      mockUpdateExecute.mockRejectedValueOnce(
        new BarberProfileNotFoundError("barber-unknown"),
      );
      const req = createJsonRequest(
        "/api/v1/admin/barbers/barber-unknown",
        "PATCH",
        { specialization: "Scissor" },
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "barber-unknown" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
    });

    it("should return 200 with updated AdminBarberDto", async () => {
      const now = new Date();
      mockUpdateExecute.mockResolvedValueOnce({
        id: "barber-1",
        userId: "user-1",
        specialization: "Scissor",
        createdAt: now,
        updatedAt: now,
      });

      const req = createJsonRequest("/api/v1/admin/barbers/barber-1", "PATCH", {
        specialization: "Scissor",
      });
      const res = await PATCH(req, {
        params: Promise.resolve({ id: "barber-1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.specialization).toBe("Scissor");
    });
  });
});
