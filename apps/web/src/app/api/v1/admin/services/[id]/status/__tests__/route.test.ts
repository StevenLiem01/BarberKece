import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";
import { ServiceNotFoundError } from "@barberkece/core/reservation";

const { mockToggleExecute } = vi.hoisted(() => ({
  mockToggleExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    ToggleServiceStatusUseCase: class {
      execute = mockToggleExecute;
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

describe("Admin Service Status Route: /api/v1/admin/services/[id]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateAdminApi.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", status: "ACTIVE" },
    });
  });

  it("should return 403 on CSRF mismatch", async () => {
    const req = createJsonRequest(
      "/api/v1/admin/services/srv-1/status",
      "PATCH",
      { isActive: false },
      {
        origin: "http://malicious.org",
      },
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: "srv-1" }) });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid body", async () => {
    const req = createJsonRequest(
      "/api/v1/admin/services/srv-1/status",
      "PATCH",
      { isActive: "not-boolean" },
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: "srv-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 if service not found", async () => {
    mockToggleExecute.mockRejectedValueOnce(
      new ServiceNotFoundError("srv-unknown"),
    );
    const req = createJsonRequest(
      "/api/v1/admin/services/srv-unknown/status",
      "PATCH",
      { isActive: false },
    );
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "srv-unknown" }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("SERVICE_NOT_FOUND");
  });

  it("should return 200 with updated status", async () => {
    const now = new Date();
    mockToggleExecute.mockResolvedValueOnce({
      id: "srv-1",
      name: "Cut",
      durationMinutes: 30,
      priceRupiah: 50000,
      description: null,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    const req = createJsonRequest(
      "/api/v1/admin/services/srv-1/status",
      "PATCH",
      { isActive: false },
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: "srv-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.isActive).toBe(false);
    expect(mockToggleExecute).toHaveBeenCalledWith("srv-1", false);
  });
});
