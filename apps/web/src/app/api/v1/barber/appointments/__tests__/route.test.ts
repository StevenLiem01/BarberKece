import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "../route";
import {
  AppointmentStatus,
  InvalidBookingDateError,
} from "@barberkece/core/reservation";

const { mockGetBarberAppointmentsExecute } = vi.hoisted(() => ({
  mockGetBarberAppointmentsExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    GetBarberAppointmentsUseCase: class {
      execute = mockGetBarberAppointmentsExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresAppointmentRepository: vi.fn(),
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

const mockAuthenticateBarberApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  authenticateBarberApi: mockAuthenticateBarberApi,
}));

describe("Barber Appointments List Route: GET /api/v1/barber/appointments", () => {
  const barberProfile = {
    id: "barber-profile-1",
    userId: "user-barber-1",
    specialization: "Fade Master",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateBarberApi.mockResolvedValue({
      user: { id: "user-barber-1", role: "BARBER", status: "ACTIVE" },
      barberProfile,
    });
  });

  it("rejects unauthenticated requests with 401", async () => {
    mockAuthenticateBarberApi.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Auth required" } },
        { status: 401 },
      ),
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments",
    );
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects non-BARBER requests with 403", async () => {
    mockAuthenticateBarberApi.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Barber role required" } },
        { status: 403 },
      ),
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments",
    );
    const res = await GET(req);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("rejects when barber profile is not found with 403", async () => {
    mockAuthenticateBarberApi.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Barber profile not found" } },
        { status: 403 },
      ),
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments",
    );
    const res = await GET(req);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("successfully lists appointments using authoritative barber profile ID without filters", async () => {
    const now = new Date();
    mockGetBarberAppointmentsExecute.mockResolvedValueOnce({
      appointments: [
        {
          id: "appt-1",
          bookingReference: "BK-001",
          customerId: "cust-1",
          barberProfileId: "barber-profile-1",
          serviceId: "srv-1",
          status: AppointmentStatus.CONFIRMED,
          startsAt: now,
          endsAt: new Date(now.getTime() + 30 * 60000),
          serviceDurationMinutes: 30,
          priceRupiah: 50000,
          notes: "Classic cut",
          cancellationReason: null,
          isAutoAssigned: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetBarberAppointmentsExecute).toHaveBeenCalledWith({
      barberProfileId: "barber-profile-1",
      date: undefined,
      from: undefined,
      to: undefined,
      status: undefined,
    });

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe("appt-1");
    expect(json.data[0].barberProfileId).toBe("barber-profile-1");
    expect(json.data[0].priceRupiah).toBe(50000);
  });

  it("passes valid calendar date filter to use case", async () => {
    mockGetBarberAppointmentsExecute.mockResolvedValueOnce({
      appointments: [],
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments?date=2026-09-12",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetBarberAppointmentsExecute).toHaveBeenCalledWith({
      barberProfileId: "barber-profile-1",
      date: "2026-09-12",
      from: undefined,
      to: undefined,
      status: undefined,
    });
  });

  it("passes valid explicit from/to range to use case", async () => {
    mockGetBarberAppointmentsExecute.mockResolvedValueOnce({
      appointments: [],
    });

    const fromIso = "2026-09-12T00:00:00.000Z";
    const toIso = "2026-09-12T12:00:00.000Z";
    const req = new NextRequest(
      `http://localhost:3000/api/v1/barber/appointments?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetBarberAppointmentsExecute).toHaveBeenCalledWith({
      barberProfileId: "barber-profile-1",
      date: undefined,
      from: new Date(fromIso),
      to: new Date(toIso),
      status: undefined,
    });
  });

  it("passes single status filter to use case", async () => {
    mockGetBarberAppointmentsExecute.mockResolvedValueOnce({
      appointments: [],
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments?status=CONFIRMED",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetBarberAppointmentsExecute).toHaveBeenCalledWith({
      barberProfileId: "barber-profile-1",
      date: undefined,
      from: undefined,
      to: undefined,
      status: "CONFIRMED",
    });
  });

  it("passes multiple comma-separated statuses to use case", async () => {
    mockGetBarberAppointmentsExecute.mockResolvedValueOnce({
      appointments: [],
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments?status=CONFIRMED,CHECKED_IN",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetBarberAppointmentsExecute).toHaveBeenCalledWith({
      barberProfileId: "barber-profile-1",
      date: undefined,
      from: undefined,
      to: undefined,
      status: ["CONFIRMED", "CHECKED_IN"],
    });
  });

  it("passes multiple repeated status query params to use case", async () => {
    mockGetBarberAppointmentsExecute.mockResolvedValueOnce({
      appointments: [],
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments?status=CONFIRMED&status=IN_SERVICE",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetBarberAppointmentsExecute).toHaveBeenCalledWith({
      barberProfileId: "barber-profile-1",
      date: undefined,
      from: undefined,
      to: undefined,
      status: ["CONFIRMED", "IN_SERVICE"],
    });
  });

  it("rejects invalid date string with 400", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments?date=12-09-2026",
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("rejects invalid from ISO string with 400", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments?from=not-a-date",
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("rejects invalid status filter with 400", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments?status=INVALID_STATUS",
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("rejects ambiguous combination of date and from/to range with 400", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments?date=2026-09-12&from=2026-09-12T00:00:00.000Z",
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(json.error.message).toBe(
      "Cannot specify both date and explicit from/to range",
    );
  });

  it("rejects when from is after to with 400", async () => {
    const fromIso = "2026-09-12T12:00:00.000Z";
    const toIso = "2026-09-12T06:00:00.000Z";
    const req = new NextRequest(
      `http://localhost:3000/api/v1/barber/appointments?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(json.error.message).toBe("from must be before to");
  });

  it("handles use case InvalidBookingDateError with 400", async () => {
    mockGetBarberAppointmentsExecute.mockRejectedValueOnce(
      new InvalidBookingDateError("Invalid calendar date"),
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments?date=2026-02-30",
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(json.error.message).toBe("Invalid calendar date");
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetBarberAppointmentsExecute.mockRejectedValueOnce(
      new Error("Database connection lost"),
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments",
    );
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
