import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import {
  ServiceNotFoundError,
  InactiveServiceError,
  BarberNotEligibleError,
} from "@barberkece/core/reservation";
import { BarberProfileNotFoundError } from "@barberkece/core/barber";

const { mockGetAvailableSlotsExecute } = vi.hoisted(() => ({
  mockGetAvailableSlotsExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    GetAvailableSlotsUseCase: class {
      execute = mockGetAvailableSlotsExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresServiceRepository: vi.fn(),
  PostgresBarberProfileRepository: vi.fn(),
  PostgresBarberEligibilityRepository: vi.fn(),
  PostgresScheduleRepository: vi.fn(),
  PostgresAppointmentRepository: vi.fn(),
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

describe("Public Available Slots Route: GET /api/v1/appointments/available-slots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guest access succeeds and returns 200 with public slots exposing ONLY startsAt and endsAt", async () => {
    const start1 = new Date("2026-09-15T09:00:00.000Z");
    const end1 = new Date("2026-09-15T09:30:00.000Z");
    const start2 = new Date("2026-09-15T09:30:00.000Z");
    const end2 = new Date("2026-09-15T10:00:00.000Z");

    mockGetAvailableSlotsExecute.mockResolvedValueOnce({
      date: "2026-09-15",
      slots: [
        { startsAt: start1, endsAt: end1 },
        { startsAt: start2, endsAt: end2 },
      ],
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/appointments/available-slots?serviceId=a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d&date=2026-09-15",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toEqual([
      {
        startsAt: start1.toISOString(),
        endsAt: end1.toISOString(),
      },
      {
        startsAt: start2.toISOString(),
        endsAt: end2.toISOString(),
      },
    ]);

    // Privacy verification: no barber IDs, candidate arrays, workloads, or counts
    expect(json.data[0].barberId).toBeUndefined();
    expect(json.data[0].barberProfileId).toBeUndefined();
    expect(json.data[0].barbers).toBeUndefined();
    expect(json.data[0].count).toBeUndefined();

    // Verify use case was called with undefined barberProfileId (ANY_AVAILABLE)
    expect(mockGetAvailableSlotsExecute).toHaveBeenCalledWith({
      serviceId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      date: "2026-09-15",
      barberProfileId: undefined,
    });
  });

  it("passes specific barberProfileId to useCase and returns public slots with ONLY startsAt and endsAt", async () => {
    const start1 = new Date("2026-09-15T10:00:00.000Z");
    const end1 = new Date("2026-09-15T10:30:00.000Z");

    mockGetAvailableSlotsExecute.mockResolvedValueOnce({
      date: "2026-09-15",
      slots: [{ startsAt: start1, endsAt: end1 }],
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/appointments/available-slots?serviceId=a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d&date=2026-09-15&barberProfileId=f1e2d3c4-b5a6-7890-a234-56789abcdef0",
    );

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toEqual([
      {
        startsAt: start1.toISOString(),
        endsAt: end1.toISOString(),
      },
    ]);

    // Privacy verification for specific barber: response still exposes ONLY startsAt + endsAt
    expect(json.data[0].barberId).toBeUndefined();
    expect(json.data[0].barberProfileId).toBeUndefined();
    expect(json.data[0].barber).toBeUndefined();

    // Verify use case was called with specific barberProfileId
    expect(mockGetAvailableSlotsExecute).toHaveBeenCalledWith({
      serviceId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      date: "2026-09-15",
      barberProfileId: "f1e2d3c4-b5a6-7890-a234-56789abcdef0",
    });
  });

  it("returns 400 when serviceId or date query parameters are missing or invalid", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/appointments/available-slots?serviceId=invalid-uuid&date=invalid-date",
    );

    const res = await GET(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("returns 400 when barberProfileId is an invalid UUID format", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/appointments/available-slots?serviceId=a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d&date=2026-09-15&barberProfileId=not-a-valid-uuid",
    );

    const res = await GET(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(mockGetAvailableSlotsExecute).not.toHaveBeenCalled();
  });

  it("maps ServiceNotFoundError to 404 NOT_FOUND", async () => {
    mockGetAvailableSlotsExecute.mockRejectedValueOnce(
      new ServiceNotFoundError("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"),
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/appointments/available-slots?serviceId=a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d&date=2026-09-15",
    );

    const res = await GET(req);
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });

  it("maps BarberProfileNotFoundError to 404 NOT_FOUND", async () => {
    mockGetAvailableSlotsExecute.mockRejectedValueOnce(
      new BarberProfileNotFoundError("f1e2d3c4-b5a6-7890-a234-56789abcdef0"),
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/appointments/available-slots?serviceId=a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d&date=2026-09-15&barberProfileId=f1e2d3c4-b5a6-7890-a234-56789abcdef0",
    );

    const res = await GET(req);
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });

  it("maps BarberNotEligibleError to 400 BAD_REQUEST", async () => {
    mockGetAvailableSlotsExecute.mockRejectedValueOnce(
      new BarberNotEligibleError(
        "f1e2d3c4-b5a6-7890-a234-56789abcdef0",
        "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      ),
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/appointments/available-slots?serviceId=a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d&date=2026-09-15&barberProfileId=f1e2d3c4-b5a6-7890-a234-56789abcdef0",
    );

    const res = await GET(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("maps InactiveServiceError to 400 BAD_REQUEST", async () => {
    mockGetAvailableSlotsExecute.mockRejectedValueOnce(
      new InactiveServiceError("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"),
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/appointments/available-slots?serviceId=a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d&date=2026-09-15",
    );

    const res = await GET(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });
});
