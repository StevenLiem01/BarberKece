import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "../route";
import {
  AppointmentStatus,
  IdempotencyPayloadMismatchError,
} from "@barberkece/core/reservation";

const { mockGetCustomerAppointmentsExecute, mockConfirmBookingExecute } =
  vi.hoisted(() => ({
    mockGetCustomerAppointmentsExecute: vi.fn(),
    mockConfirmBookingExecute: vi.fn(),
  }));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    GetCustomerAppointmentsUseCase: class {
      execute = mockGetCustomerAppointmentsExecute;
    },
    ConfirmBookingUseCase: class {
      execute = mockConfirmBookingExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresAppointmentRepository: vi.fn(),
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

describe("Appointments Route: /api/v1/appointments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateCustomerApi.mockResolvedValue({
      user: { id: "cust-1", role: "CUSTOMER", status: "ACTIVE" },
    });
  });

  describe("GET /api/v1/appointments", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockAuthenticateCustomerApi.mockResolvedValueOnce({
        response: NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Auth required" } },
          { status: 401 },
        ),
      });

      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("rejects non-CUSTOMER actors with 403", async () => {
      mockAuthenticateCustomerApi.mockResolvedValueOnce({
        response: NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Customer role required" } },
          { status: 403 },
        ),
      });

      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("binds customerId from session and returns serialized AppointmentDto array", async () => {
      const now = new Date();
      mockGetCustomerAppointmentsExecute.mockResolvedValueOnce([
        {
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
          notes: null,
          cancellationReason: null,
          isAutoAssigned: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(mockGetCustomerAppointmentsExecute).toHaveBeenCalledWith("cust-1");
      expect(json.data).toEqual([
        {
          id: "appt-1",
          bookingReference: "BK-001",
          serviceId: "srv-1",
          status: "CONFIRMED",
          startsAt: now.toISOString(),
          endsAt: new Date(now.getTime() + 30 * 60000).toISOString(),
          priceRupiah: 50000,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ]);
    });
  });

  describe("POST /api/v1/appointments", () => {
    const validBody = {
      serviceId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      startsAt: "2026-09-15T10:00:00.000Z",
      notes: "Please trim carefully",
    };

    it("rejects cross-origin request without matching origin header (CSRF defense)", async () => {
      const req = new NextRequest(
        new URL("http://localhost:3000/api/v1/appointments"),
        {
          method: "POST",
          headers: {
            host: "localhost:3000",
            origin: "http://malicious-site.com",
            "content-type": "application/json",
          },
          body: JSON.stringify(validBody),
        },
      );

      const res = await POST(req);
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
        "http://localhost:3000/api/v1/appointments",
        "POST",
        validBody,
      );
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("rejects invalid request body with 400", async () => {
      const req = createJsonRequest(
        "http://localhost:3000/api/v1/appointments",
        "POST",
        {
          serviceId: "not-a-uuid",
        },
      );

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("BAD_REQUEST");
    });

    it("binds actor and customer identity to session and forwards Idempotency-Key", async () => {
      const now = new Date();
      mockConfirmBookingExecute.mockResolvedValueOnce({
        appointment: {
          id: "appt-confirmed",
          bookingReference: "BK-CONFIRMED",
          customerId: "cust-1",
          barberProfileId: "barber-1",
          serviceId: validBody.serviceId,
          status: AppointmentStatus.CONFIRMED,
          startsAt: new Date(validBody.startsAt),
          endsAt: new Date(new Date(validBody.startsAt).getTime() + 30 * 60000),
          serviceDurationMinutes: 30,
          priceRupiah: 60000,
          notes: validBody.notes,
          cancellationReason: null,
          isAutoAssigned: false,
          createdAt: now,
          updatedAt: now,
        },
        isIdempotentReplay: false,
      });

      const req = createJsonRequest(
        "http://localhost:3000/api/v1/appointments",
        "POST",
        validBody,
        { "Idempotency-Key": "idem-key-12345" },
      );

      const res = await POST(req);
      expect(res.status).toBe(201);

      expect(mockConfirmBookingExecute).toHaveBeenCalledWith({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: validBody.serviceId,
        startsAt: new Date(validBody.startsAt),
        barberProfileId: undefined,
        notes: validBody.notes,
        idempotencyKey: "idem-key-12345",
      });

      const json = await res.json();
      expect(json.data.id).toBe("appt-confirmed");
      expect(json.data.bookingReference).toBe("BK-CONFIRMED");
    });

    it("maps IdempotencyPayloadMismatchError to 409 CONFLICT", async () => {
      mockConfirmBookingExecute.mockRejectedValueOnce(
        new IdempotencyPayloadMismatchError("idem-key-conflict"),
      );

      const req = createJsonRequest(
        "http://localhost:3000/api/v1/appointments",
        "POST",
        validBody,
        { "Idempotency-Key": "idem-key-conflict" },
      );

      const res = await POST(req);
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.error.code).toBe("CONFLICT");
    });
  });
});
