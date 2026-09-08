import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { ServiceNotFoundError } from "@barberkece/core/reservation";

const { mockGetExecute } = vi.hoisted(() => ({
  mockGetExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    GetServiceUseCase: class {
      execute = mockGetExecute;
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

describe("Public Service Detail Route: /api/v1/services/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 if service is inactive (activeOnly: true enforced)", async () => {
    // GetServiceUseCase throws ServiceNotFoundError when activeOnly: true and service is inactive
    mockGetExecute.mockRejectedValueOnce(
      new ServiceNotFoundError("srv-inactive"),
    );

    const req = new NextRequest(
      new URL("/api/v1/services/srv-inactive", "http://localhost:3000"),
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "srv-inactive" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("SERVICE_NOT_FOUND");
    expect(mockGetExecute).toHaveBeenCalledWith("srv-inactive", {
      activeOnly: true,
    });
  });

  it("should return 404 if service does not exist", async () => {
    mockGetExecute.mockRejectedValueOnce(
      new ServiceNotFoundError("srv-unknown"),
    );

    const req = new NextRequest(
      new URL("/api/v1/services/srv-unknown", "http://localhost:3000"),
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "srv-unknown" }),
    });

    expect(res.status).toBe(404);
  });

  it("should return 200 with PublicServiceDto for active service", async () => {
    const now = new Date();
    mockGetExecute.mockResolvedValueOnce({
      id: "srv-1",
      name: "Classic Cut",
      durationMinutes: 30,
      priceRupiah: 50000,
      description: "A neat cut",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const req = new NextRequest(
      new URL("/api/v1/services/srv-1", "http://localhost:3000"),
    );
    const res = await GET(req, { params: Promise.resolve({ id: "srv-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({
      id: "srv-1",
      name: "Classic Cut",
      durationMinutes: 30,
      priceRupiah: 50000,
      description: "A neat cut",
    });
    // Verify no internal fields leaked
    expect(json.data.isActive).toBeUndefined();
    expect(json.data.createdAt).toBeUndefined();
  });
});
