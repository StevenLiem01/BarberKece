import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "../route";
import { ServiceNotFoundError } from "@barberkece/core/reservation";
import { BarberProfileNotFoundError } from "@barberkece/core/barber";

const { mockRemoveExecute } = vi.hoisted(() => ({
  mockRemoveExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    RemoveServiceFromBarberUseCase: class {
      execute = mockRemoveExecute;
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

describe("Admin Remove Barber Service Route: /api/v1/admin/barbers/[id]/services/[serviceId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateAdminApi.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", status: "ACTIVE" },
    });
  });

  it("should return 403 on CSRF mismatch", async () => {
    const req = createJsonRequest(
      "/api/v1/admin/barbers/b-1/services/s-1",
      "DELETE",
      undefined,
      {
        origin: "http://malicious.com",
      },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "b-1", serviceId: "s-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("should return 404 if barber profile not found", async () => {
    mockRemoveExecute.mockRejectedValueOnce(
      new BarberProfileNotFoundError("b-unknown"),
    );
    const req = createJsonRequest(
      "/api/v1/admin/barbers/b-unknown/services/s-1",
      "DELETE",
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "b-unknown", serviceId: "s-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("should return 404 if service not found", async () => {
    mockRemoveExecute.mockRejectedValueOnce(
      new ServiceNotFoundError("s-unknown"),
    );
    const req = createJsonRequest(
      "/api/v1/admin/barbers/b-1/services/s-unknown",
      "DELETE",
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "b-1", serviceId: "s-unknown" }),
    });
    expect(res.status).toBe(404);
  });

  it("should return 200 on success", async () => {
    mockRemoveExecute.mockResolvedValueOnce(undefined);
    const req = createJsonRequest(
      "/api/v1/admin/barbers/b-1/services/s-1",
      "DELETE",
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "b-1", serviceId: "s-1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.success).toBe(true);
    expect(mockRemoveExecute).toHaveBeenCalledWith({
      barberProfileId: "b-1",
      serviceId: "s-1",
    });
  });
});
