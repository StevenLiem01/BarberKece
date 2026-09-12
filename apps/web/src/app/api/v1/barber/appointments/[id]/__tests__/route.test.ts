import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "../route";
import {
  AppointmentStatus,
  AppointmentNotFoundError,
  AppointmentOwnershipError,
} from "@barberkece/core/reservation";

const { mockGetBarberAppointmentDetailExecute } = vi.hoisted(() => ({
  mockGetBarberAppointmentDetailExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    GetBarberAppointmentDetailUseCase: class {
      execute = mockGetBarberAppointmentDetailExecute;
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

describe("Barber Appointment Detail Route: GET /api/v1/barber/appointments/[id]", () => {
  const validUuid = "018f9e0a-1234-7000-8000-000000000001";
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
      `http://localhost:3000/api/v1/barber/appointments/${validUuid}`,
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: validUuid }),
    });

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
      `http://localhost:3000/api/v1/barber/appointments/${validUuid}`,
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("rejects when barber profile is missing with 403", async () => {
    mockAuthenticateBarberApi.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Barber profile not found" } },
        { status: 403 },
      ),
    });

    const req = new NextRequest(
      `http://localhost:3000/api/v1/barber/appointments/${validUuid}`,
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("rejects malformed appointment ID with 400", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/barber/appointments/not-a-uuid",
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(json.error.message).toBe("Invalid appointment ID format");
  });

  it("returns 200 with BarberAppointmentDto for owned appointment", async () => {
    const now = new Date();
    mockGetBarberAppointmentDetailExecute.mockResolvedValueOnce({
      appointment: {
        id: validUuid,
        bookingReference: "BK-100",
        customerId: "cust-1",
        barberProfileId: "barber-profile-1",
        serviceId: "srv-1",
        status: AppointmentStatus.CHECKED_IN,
        startsAt: now,
        endsAt: new Date(now.getTime() + 45 * 60000),
        serviceDurationMinutes: 45,
        priceRupiah: 75000,
        notes: "Beard trim included",
        cancellationReason: null,
        isAutoAssigned: false,
        createdAt: now,
        updatedAt: now,
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/v1/barber/appointments/${validUuid}`,
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(200);
    expect(mockGetBarberAppointmentDetailExecute).toHaveBeenCalledWith({
      appointmentId: validUuid,
      barberProfileId: "barber-profile-1",
    });

    const json = await res.json();
    expect(json.data.id).toBe(validUuid);
    expect(json.data.bookingReference).toBe("BK-100");
    expect(json.data.customerId).toBe("cust-1");
    expect(json.data.barberProfileId).toBe("barber-profile-1");
    expect(json.data.status).toBe("CHECKED_IN");
    expect(json.data.priceRupiah).toBe(75000);
    expect(json.data.notes).toBe("Beard trim included");
  });

  it("isolates foreign appointment with 404 NOT_FOUND to prevent IDOR enumeration", async () => {
    mockGetBarberAppointmentDetailExecute.mockRejectedValueOnce(
      new AppointmentOwnershipError(validUuid, "barber-profile-1"),
    );

    const req = new NextRequest(
      `http://localhost:3000/api/v1/barber/appointments/${validUuid}`,
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
    expect(json.error.message).toBe("Appointment not found");
  });

  it("returns 404 NOT_FOUND when appointment does not exist", async () => {
    mockGetBarberAppointmentDetailExecute.mockRejectedValueOnce(
      new AppointmentNotFoundError(validUuid),
    );

    const req = new NextRequest(
      `http://localhost:3000/api/v1/barber/appointments/${validUuid}`,
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
    expect(json.error.message).toBe("Appointment not found");
  });

  it("returns 500 on unexpected errors", async () => {
    mockGetBarberAppointmentDetailExecute.mockRejectedValueOnce(
      new Error("Database failure"),
    );

    const req = new NextRequest(
      `http://localhost:3000/api/v1/barber/appointments/${validUuid}`,
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
