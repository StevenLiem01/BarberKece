import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { BarberProfileNotFoundError } from "@barberkece/core/barber";

const { mockGetEligibleExecute } = vi.hoisted(() => ({
  mockGetEligibleExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    GetBarberEligibleServicesUseCase: class {
      execute = mockGetEligibleExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresBarberEligibilityRepository: vi.fn(),
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

describe("Public Barber Services Route: /api/v1/barbers/[id]/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 if barber profile not found", async () => {
    mockGetEligibleExecute.mockRejectedValueOnce(
      new BarberProfileNotFoundError("barber-unknown"),
    );

    const req = new NextRequest(
      new URL(
        "/api/v1/barbers/barber-unknown/services",
        "http://localhost:3000",
      ),
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "barber-unknown" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });

  it("should return 200 with active eligible services (PublicServiceDto[])", async () => {
    const now = new Date();
    mockGetEligibleExecute.mockResolvedValueOnce([
      {
        id: "srv-1",
        name: "Classic Cut",
        durationMinutes: 30,
        priceRupiah: 50000,
        description: "Fresh haircut",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const req = new NextRequest(
      new URL("/api/v1/barbers/barber-1/services", "http://localhost:3000"),
    );
    const res = await GET(req, { params: Promise.resolve({ id: "barber-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([
      {
        id: "srv-1",
        name: "Classic Cut",
        durationMinutes: 30,
        priceRupiah: 50000,
        description: "Fresh haircut",
      },
    ]);
    expect(mockGetEligibleExecute).toHaveBeenCalledWith({
      barberProfileId: "barber-1",
      activeOnly: true,
    });
    // Internal fields omitted
    expect(json.data[0].isActive).toBeUndefined();
  });
});
