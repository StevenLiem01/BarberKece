import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";
import {
  AppointmentStatus,
  AppointmentNotFoundError,
  AppointmentOwnershipError,
  CancellationCutoffExceededError,
} from "@barberkece/core/reservation";

const { mockCancelAppointmentExecute } = vi.hoisted(() => ({
  mockCancelAppointmentExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    CancelAppointmentUseCase: class {
      execute = mockCancelAppointmentExecute;
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

describe("Cancel Appointment Route: POST /api/v1/appointments/[id]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateCustomerApi.mockResolvedValue({
      user: { id: "cust-1", role: "CUSTOMER", status: "ACTIVE" },
    });
  });

  it("rejects cross-origin request without matching origin header (CSRF defense)", async () => {
    const req = new NextRequest(
      new URL("http://localhost:3000/api/v1/appointments/appt-1/cancel"),
      {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://attacker.com",
          "content-type": "application/json",
        },
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
      "http://localhost:3000/api/v1/appointments/appt-1/cancel",
      "POST",
    );
    const res = await POST(req, { params: Promise.resolve({ id: "appt-1" }) });
    expect(res.status).toBe(401);
  });

  it("maps AppointmentNotFoundError to 404 NOT_FOUND", async () => {
    mockCancelAppointmentExecute.mockRejectedValueOnce(
      new AppointmentNotFoundError("appt-missing"),
    );

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/appointments/appt-missing/cancel",
      "POST",
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: "appt-missing" }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });

  it("maps AppointmentOwnershipError to 404 NOT_FOUND (safe IDOR protection)", async () => {
    mockCancelAppointmentExecute.mockRejectedValueOnce(
      new AppointmentOwnershipError("appt-1", "cust-1"),
    );

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/appointments/appt-1/cancel",
      "POST",
      {
        reason: "Cannot make it",
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "appt-1" }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });

  it("maps CancellationCutoffExceededError to 400 BAD_REQUEST", async () => {
    mockCancelAppointmentExecute.mockRejectedValueOnce(
      new CancellationCutoffExceededError(new Date(), 2),
    );

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/appointments/appt-1/cancel",
      "POST",
    );
    const res = await POST(req, { params: Promise.resolve({ id: "appt-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("cancels appointment successfully and returns 200 with updated DTO", async () => {
    const now = new Date();
    mockCancelAppointmentExecute.mockResolvedValueOnce({
      appointment: {
        id: "appt-1",
        bookingReference: "BK-001",
        customerId: "cust-1",
        barberProfileId: "barber-1",
        serviceId: "srv-1",
        status: AppointmentStatus.CANCELLED_BY_CUSTOMER,
        startsAt: now,
        endsAt: new Date(now.getTime() + 30 * 60000),
        serviceDurationMinutes: 30,
        priceRupiah: 50000,
        notes: null,
        cancellationReason: "Change of plans",
        isAutoAssigned: false,
        createdAt: now,
        updatedAt: now,
      },
    });

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/appointments/appt-1/cancel",
      "POST",
      {
        reason: "Change of plans",
      },
    );

    const res = await POST(req, { params: Promise.resolve({ id: "appt-1" }) });
    expect(res.status).toBe(200);

    expect(mockCancelAppointmentExecute).toHaveBeenCalledWith({
      actorId: "cust-1",
      appointmentId: "appt-1",
      cancellationReason: "Change of plans",
    });

    const json = await res.json();
    expect(json.data.status).toBe("CANCELLED_BY_CUSTOMER");
  });
});
