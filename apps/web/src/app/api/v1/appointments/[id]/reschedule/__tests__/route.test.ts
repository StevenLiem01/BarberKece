import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";
import {
  AppointmentStatus,
  AppointmentOwnershipError,
  RescheduleCutoffExceededError,
  SlotAlreadyBookedError,
} from "@barberkece/core/reservation";

const { mockRescheduleAppointmentExecute } = vi.hoisted(() => ({
  mockRescheduleAppointmentExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    RescheduleAppointmentUseCase: class {
      execute = mockRescheduleAppointmentExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresBookingTransactionRunner: vi.fn(),
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

describe("Reschedule Appointment Route: POST /api/v1/appointments/[id]/reschedule", () => {
  const validBody = {
    newStartsAt: "2026-09-20T14:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateCustomerApi.mockResolvedValue({
      user: { id: "cust-1", role: "CUSTOMER", status: "ACTIVE" },
    });
  });

  it("rejects cross-origin request without matching origin header (CSRF defense)", async () => {
    const req = new NextRequest(
      new URL("http://localhost:3000/api/v1/appointments/appt-1/reschedule"),
      {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://attacker.com",
          "content-type": "application/json",
        },
        body: JSON.stringify(validBody),
      },
    );

    const res = await POST(req, { params: Promise.resolve({ id: "appt-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("rejects unauthenticated requests with 401", async () => {
    mockAuthenticateCustomerApi.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Auth required" } },
        { status: 401 },
      ),
    });

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/appointments/appt-1/reschedule",
      "POST",
      validBody,
    );
    const res = await POST(req, { params: Promise.resolve({ id: "appt-1" }) });
    expect(res.status).toBe(401);
  });

  it("maps AppointmentOwnershipError to 404 NOT_FOUND", async () => {
    mockRescheduleAppointmentExecute.mockRejectedValueOnce(
      new AppointmentOwnershipError("appt-1", "cust-1"),
    );

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/appointments/appt-1/reschedule",
      "POST",
      validBody,
    );
    const res = await POST(req, { params: Promise.resolve({ id: "appt-1" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });

  it("maps RescheduleCutoffExceededError to 400 BAD_REQUEST", async () => {
    mockRescheduleAppointmentExecute.mockRejectedValueOnce(
      new RescheduleCutoffExceededError(new Date(), 2),
    );

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/appointments/appt-1/reschedule",
      "POST",
      validBody,
    );
    const res = await POST(req, { params: Promise.resolve({ id: "appt-1" }) });
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("maps SlotAlreadyBookedError to 400 BAD_REQUEST", async () => {
    mockRescheduleAppointmentExecute.mockRejectedValueOnce(
      new SlotAlreadyBookedError("barber-1", {
        startsAt: new Date(),
        endsAt: new Date(),
      }),
    );

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/appointments/appt-1/reschedule",
      "POST",
      validBody,
    );
    const res = await POST(req, { params: Promise.resolve({ id: "appt-1" }) });
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("reschedules appointment successfully with server-derived end time", async () => {
    const newStartsAt = new Date(validBody.newStartsAt);
    const newEndsAt = new Date(newStartsAt.getTime() + 30 * 60000);
    const now = new Date();

    mockRescheduleAppointmentExecute.mockResolvedValueOnce({
      appointment: {
        id: "appt-1",
        bookingReference: "BK-001",
        customerId: "cust-1",
        barberProfileId: "barber-1",
        serviceId: "srv-1",
        status: AppointmentStatus.CONFIRMED,
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        serviceDurationMinutes: 30,
        priceRupiah: 50000,
        notes: null,
        cancellationReason: null,
        isAutoAssigned: false,
        createdAt: now,
        updatedAt: now,
      },
    });

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/appointments/appt-1/reschedule",
      "POST",
      validBody,
    );
    const res = await POST(req, { params: Promise.resolve({ id: "appt-1" }) });
    expect(res.status).toBe(200);

    // Client cannot pass newEndsAt; core receives only actorId, appointmentId, newStartsAt
    expect(mockRescheduleAppointmentExecute).toHaveBeenCalledWith({
      actorId: "cust-1",
      appointmentId: "appt-1",
      newStartsAt,
    });

    const json = await res.json();
    expect(json.data.startsAt).toBe(newStartsAt.toISOString());
    expect(json.data.endsAt).toBe(newEndsAt.toISOString());
  });
});
