import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "../route";
import {
  AppointmentNotFoundError,
  AppointmentStatus,
} from "@barberkece/core/reservation";

const { mockGetAppointmentExecute } = vi.hoisted(() => ({
  mockGetAppointmentExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    GetAppointmentUseCase: class {
      execute = mockGetAppointmentExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
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

const mockAuthenticateCustomerApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  authenticateCustomerApi: mockAuthenticateCustomerApi,
}));

describe("Appointment Detail Route: GET /api/v1/appointments/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateCustomerApi.mockResolvedValue({
      user: { id: "cust-1", role: "CUSTOMER", status: "ACTIVE" },
    });
  });

  it("rejects unauthenticated requests with 401", async () => {
    mockAuthenticateCustomerApi.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Auth required" } },
        { status: 401 },
      ),
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/appointments/appt-1",
    );
    const res = await GET(req, { params: Promise.resolve({ id: "appt-1" }) });

    expect(res.status).toBe(401);
  });

  it("owned appointment succeeds and returns 200 with AppointmentDto", async () => {
    const now = new Date();
    mockGetAppointmentExecute.mockResolvedValueOnce({
      id: "appt-1",
      bookingReference: "BK-001",
      customerId: "cust-1",
      barberProfileId: "barber-1",
      serviceId: "srv-1",
      status: AppointmentStatus.CONFIRMED,
      startsAt: now,
      endsAt: new Date(now.getTime() + 30 * 60000),
      serviceDurationMinutes: 30,
      priceRupiah: 50000,
      notes: "Trim",
      cancellationReason: null,
      isAutoAssigned: false,
      createdAt: now,
      updatedAt: now,
    });

    const req = new NextRequest(
      "http://localhost:3000/api/v1/appointments/appt-1",
    );
    const res = await GET(req, { params: Promise.resolve({ id: "appt-1" }) });

    expect(res.status).toBe(200);
    expect(mockGetAppointmentExecute).toHaveBeenCalledWith("appt-1", "cust-1");

    const json = await res.json();
    expect(json.data.id).toBe("appt-1");
    expect(json.data.bookingReference).toBe("BK-001");
  });

  it("IDOR attempt for appointment belonging to another customer is rejected with 404 NOT_FOUND", async () => {
    // When customer context does not match, GetAppointmentUseCase throws AppointmentNotFoundError
    mockGetAppointmentExecute.mockRejectedValueOnce(
      new AppointmentNotFoundError("appt-other"),
    );

    const req = new NextRequest(
      "http://localhost:3000/api/v1/appointments/appt-other",
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "appt-other" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });
});
