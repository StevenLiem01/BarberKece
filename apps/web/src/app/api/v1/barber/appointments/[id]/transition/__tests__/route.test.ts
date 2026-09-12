import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";
import {
  AppointmentStatus,
  AppointmentNotFoundError,
  AppointmentOwnershipError,
  InvalidAppointmentStatusTransitionError,
  NoShowGracePeriodNotElapsedError,
  CancellationReasonRequiredError,
} from "@barberkece/core/reservation";

const { mockTransitionStatusExecute } = vi.hoisted(() => ({
  mockTransitionStatusExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    TransitionAppointmentStatusUseCase: class {
      execute = mockTransitionStatusExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresBookingTransactionRunner: vi.fn(),
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

describe("Barber Appointment Status Transition Route: POST /api/v1/barber/appointments/[id]/transition", () => {
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

  it("rejects cross-origin request without matching origin header (CSRF defense)", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/v1/barber/appointments/${validUuid}/transition`,
      {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://attacker.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ targetStatus: "CHECKED_IN" }),
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("rejects unauthenticated requests with 401", async () => {
    mockAuthenticateBarberApi.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Auth required" } },
        { status: 401 },
      ),
    });

    const req = createJsonRequest(
      `/api/v1/barber/appointments/${validUuid}/transition`,
      "POST",
      { targetStatus: "CHECKED_IN" },
    );
    const res = await POST(req, {
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

    const req = createJsonRequest(
      `/api/v1/barber/appointments/${validUuid}/transition`,
      "POST",
      { targetStatus: "CHECKED_IN" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

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

    const req = createJsonRequest(
      `/api/v1/barber/appointments/${validUuid}/transition`,
      "POST",
      { targetStatus: "CHECKED_IN" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("rejects malformed appointment ID with 400", async () => {
    const req = createJsonRequest(
      "/api/v1/barber/appointments/not-a-uuid/transition",
      "POST",
      { targetStatus: "CHECKED_IN" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(json.error.message).toBe("Invalid appointment ID format");
  });

  it("rejects malformed JSON body with 400", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/v1/barber/appointments/${validUuid}/transition`,
      {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: "invalid-json{",
      },
    );

    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(json.error.message).toBe("Invalid JSON body");
  });

  it("rejects targetStatus not allowed for barber (e.g. CANCELLED_BY_CUSTOMER) with 400", async () => {
    const req = createJsonRequest(
      `/api/v1/barber/appointments/${validUuid}/transition`,
      "POST",
      { targetStatus: "CANCELLED_BY_CUSTOMER" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("rejects CANCELLED_BY_BARBERSHOP without a cancellation reason with 400", async () => {
    const req = createJsonRequest(
      `/api/v1/barber/appointments/${validUuid}/transition`,
      "POST",
      { targetStatus: "CANCELLED_BY_BARBERSHOP", cancellationReason: "" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(json.error.details.cancellationReason._errors[0]).toBe(
      "Cancellation reason is required when barbershop cancels an appointment",
    );
  });

  // Test each allowed M4 barber operational transition transport path
  const allowedTransitions = [
    { targetStatus: "CHECKED_IN", body: { targetStatus: "CHECKED_IN" } },
    { targetStatus: "IN_SERVICE", body: { targetStatus: "IN_SERVICE" } },
    { targetStatus: "COMPLETED", body: { targetStatus: "COMPLETED" } },
    { targetStatus: "NO_SHOW", body: { targetStatus: "NO_SHOW" } },
    {
      targetStatus: "CANCELLED_BY_BARBERSHOP",
      body: {
        targetStatus: "CANCELLED_BY_BARBERSHOP",
        cancellationReason: "Emergency maintenance",
      },
    },
  ];

  for (const { targetStatus, body } of allowedTransitions) {
    it(`successfully executes transport transition to ${targetStatus}`, async () => {
      const now = new Date();
      mockTransitionStatusExecute.mockResolvedValueOnce({
        appointment: {
          id: validUuid,
          bookingReference: "BK-TRANS",
          customerId: "cust-1",
          barberProfileId: "barber-profile-1",
          serviceId: "srv-1",
          status: targetStatus as AppointmentStatus,
          startsAt: now,
          endsAt: new Date(now.getTime() + 30 * 60000),
          serviceDurationMinutes: 30,
          priceRupiah: 60000,
          notes: null,
          cancellationReason:
            targetStatus === "CANCELLED_BY_BARBERSHOP"
              ? "Emergency maintenance"
              : null,
          isAutoAssigned: false,
          createdAt: now,
          updatedAt: now,
        },
      });

      const req = createJsonRequest(
        `/api/v1/barber/appointments/${validUuid}/transition`,
        "POST",
        body,
      );
      const res = await POST(req, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(res.status).toBe(200);
      expect(mockTransitionStatusExecute).toHaveBeenCalledWith({
        appointmentId: validUuid,
        barberProfileId: "barber-profile-1",
        targetStatus,
        cancellationReason:
          targetStatus === "CANCELLED_BY_BARBERSHOP"
            ? "Emergency maintenance"
            : undefined,
      });

      const json = await res.json();
      expect(json.data.status).toBe(targetStatus);
      expect(json.data.id).toBe(validUuid);
    });
  }

  it("maps InvalidAppointmentStatusTransitionError to 400", async () => {
    mockTransitionStatusExecute.mockRejectedValueOnce(
      new InvalidAppointmentStatusTransitionError(
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.COMPLETED,
      ),
    );

    const req = createJsonRequest(
      `/api/v1/barber/appointments/${validUuid}/transition`,
      "POST",
      { targetStatus: "COMPLETED" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("maps NoShowGracePeriodNotElapsedError to 400", async () => {
    mockTransitionStatusExecute.mockRejectedValueOnce(
      new NoShowGracePeriodNotElapsedError(new Date(), 15),
    );

    const req = createJsonRequest(
      `/api/v1/barber/appointments/${validUuid}/transition`,
      "POST",
      { targetStatus: "NO_SHOW" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
  });

  it("maps CancellationReasonRequiredError from use case to 400", async () => {
    mockTransitionStatusExecute.mockRejectedValueOnce(
      new CancellationReasonRequiredError("Reason is mandatory"),
    );

    const req = createJsonRequest(
      `/api/v1/barber/appointments/${validUuid}/transition`,
      "POST",
      {
        targetStatus: "CANCELLED_BY_BARBERSHOP",
        cancellationReason: "valid on transport",
      },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("BAD_REQUEST");
    expect(json.error.message).toBe("Reason is mandatory");
  });

  it("isolates foreign appointment with 404 NOT_FOUND", async () => {
    mockTransitionStatusExecute.mockRejectedValueOnce(
      new AppointmentOwnershipError(validUuid, "barber-profile-1"),
    );

    const req = createJsonRequest(
      `/api/v1/barber/appointments/${validUuid}/transition`,
      "POST",
      { targetStatus: "CHECKED_IN" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
    expect(json.error.message).toBe("Appointment not found");
  });

  it("returns 404 NOT_FOUND when appointment does not exist", async () => {
    mockTransitionStatusExecute.mockRejectedValueOnce(
      new AppointmentNotFoundError(validUuid),
    );

    const req = createJsonRequest(
      `/api/v1/barber/appointments/${validUuid}/transition`,
      "POST",
      { targetStatus: "CHECKED_IN" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
    expect(json.error.message).toBe("Appointment not found");
  });

  it("returns 500 on unexpected errors", async () => {
    mockTransitionStatusExecute.mockRejectedValueOnce(
      new Error("Lock acquisition failure"),
    );

    const req = createJsonRequest(
      `/api/v1/barber/appointments/${validUuid}/transition`,
      "POST",
      { targetStatus: "CHECKED_IN" },
    );
    const res = await POST(req, {
      params: Promise.resolve({ id: validUuid }),
    });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
