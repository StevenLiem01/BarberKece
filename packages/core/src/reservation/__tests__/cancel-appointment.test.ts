import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CancelAppointmentUseCase,
  CancelAppointmentInput,
} from "../use-cases/cancel-appointment.js";
import { AppointmentStatus } from "../domain/appointment-status.js";
import type { Appointment } from "../models/appointment.js";
import type { AppointmentRepository } from "../ports/appointment-repository.js";
import type { ScheduleRepository } from "../ports/schedule-repository.js";
import type { BarberEligibilityRepository } from "../ports/barber-eligibility-repository.js";
import type { ServiceRepository } from "../ports/service-repository.js";
import type { IdempotencyRepository } from "../ports/idempotency-repository.js";
import type { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";
import type {
  BookingTransactionRunner,
  BookingTransactionContext,
} from "../ports/booking-transaction-runner.js";
import type { Clock } from "../ports/clock.js";
import {
  AppointmentNotFoundError,
  AppointmentOwnershipError,
  CancellationCutoffExceededError,
  InvalidAppointmentStatusTransitionError,
} from "../errors.js";

describe("CancelAppointmentUseCase", () => {
  // Reference now: Wednesday 2026-09-09 08:00:00 Jakarta (01:00:00 UTC)
  const FIXED_NOW = new Date("2026-09-09T01:00:00.000Z");

  const mockClock: Clock = {
    now: vi.fn(() => FIXED_NOW),
  };

  const sampleAppointment: Appointment = {
    id: "appt-1",
    bookingReference: "BK-20260909-001",
    customerId: "cust-1",
    barberProfileId: "barber-1",
    serviceId: "svc-1",
    status: AppointmentStatus.CONFIRMED,
    // 12:00:00 Jakarta (4 hours in the future)
    startsAt: new Date("2026-09-09T05:00:00.000Z"),
    endsAt: new Date("2026-09-09T05:45:00.000Z"),
    serviceDurationMinutes: 45,
    priceRupiah: 75000,
    notes: null,
    cancellationReason: null,
    isAutoAssigned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockAppointmentRepo: Partial<AppointmentRepository>;
  let mockTxRunner: BookingTransactionRunner;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAppointmentRepo = {
      lockAppointment: vi.fn(async () => ({ ...sampleAppointment })),
      updateStatus: vi.fn(async (_id, status, cancellationReason) => ({
        ...sampleAppointment,
        status,
        cancellationReason: cancellationReason ?? null,
        updatedAt: new Date(),
      })),
    };

    mockTxRunner = {
      run: vi.fn(async (work) => {
        const context: BookingTransactionContext = {
          appointmentRepository: mockAppointmentRepo as AppointmentRepository,
          scheduleRepository: {} as unknown as ScheduleRepository,
          barberEligibilityRepository:
            {} as unknown as BarberEligibilityRepository,
          barberProfileRepository: {} as unknown as BarberProfileRepository,
          serviceRepository: {} as unknown as ServiceRepository,
          idempotencyRepository: {} as unknown as IdempotencyRepository,
        };
        return await work(context);
      }),
    };
  });

  it("successfully cancels confirmed appointment >= 2 hours before start time", async () => {
    const useCase = new CancelAppointmentUseCase(mockTxRunner, mockClock);
    const input: CancelAppointmentInput = {
      actorId: "cust-1",
      appointmentId: "appt-1",
      cancellationReason: "Change of plans",
    };

    const result = await useCase.execute(input);

    expect(result.appointment.status).toBe(
      AppointmentStatus.CANCELLED_BY_CUSTOMER,
    );
    expect(result.appointment.cancellationReason).toBe("Change of plans");
    expect(mockAppointmentRepo.lockAppointment).toHaveBeenCalledWith("appt-1");
    expect(mockAppointmentRepo.updateStatus).toHaveBeenCalledWith(
      "appt-1",
      AppointmentStatus.CANCELLED_BY_CUSTOMER,
      "Change of plans",
    );
  });

  it("successfully cancels without cancellationReason", async () => {
    const useCase = new CancelAppointmentUseCase(mockTxRunner, mockClock);
    const input: CancelAppointmentInput = {
      actorId: "cust-1",
      appointmentId: "appt-1",
    };

    const result = await useCase.execute(input);

    expect(result.appointment.status).toBe(
      AppointmentStatus.CANCELLED_BY_CUSTOMER,
    );
    expect(mockAppointmentRepo.updateStatus).toHaveBeenCalledWith(
      "appt-1",
      AppointmentStatus.CANCELLED_BY_CUSTOMER,
      null,
    );
  });

  it("rejects cancellation when less than 2 hours before start time", async () => {
    // Starts at 09:30:00 Jakarta (1.5 hours in the future)
    mockAppointmentRepo.lockAppointment = vi.fn(async () => ({
      ...sampleAppointment,
      startsAt: new Date("2026-09-09T02:30:00.000Z"),
      endsAt: new Date("2026-09-09T03:15:00.000Z"),
    }));

    const useCase = new CancelAppointmentUseCase(mockTxRunner, mockClock);
    const input: CancelAppointmentInput = {
      actorId: "cust-1",
      appointmentId: "appt-1",
    };

    await expect(useCase.execute(input)).rejects.toThrow(
      CancellationCutoffExceededError,
    );
    expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("rejects cancellation when actorId does not match customerId (ownership check)", async () => {
    const useCase = new CancelAppointmentUseCase(mockTxRunner, mockClock);
    const input: CancelAppointmentInput = {
      actorId: "another-customer",
      appointmentId: "appt-1",
    };

    await expect(useCase.execute(input)).rejects.toThrow(
      AppointmentOwnershipError,
    );
    expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("rejects cancellation if appointment does not exist", async () => {
    mockAppointmentRepo.lockAppointment = vi.fn(async () => null);

    const useCase = new CancelAppointmentUseCase(mockTxRunner, mockClock);
    const input: CancelAppointmentInput = {
      actorId: "cust-1",
      appointmentId: "non-existent",
    };

    await expect(useCase.execute(input)).rejects.toThrow(
      AppointmentNotFoundError,
    );
    expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("rejects cancellation if appointment is not in CONFIRMED status", async () => {
    const nonConfirmedStatuses = [
      AppointmentStatus.CHECKED_IN,
      AppointmentStatus.IN_SERVICE,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED_BY_CUSTOMER,
      AppointmentStatus.CANCELLED_BY_BARBERSHOP,
      AppointmentStatus.NO_SHOW,
    ];

    for (const status of nonConfirmedStatuses) {
      mockAppointmentRepo.lockAppointment = vi.fn(async () => ({
        ...sampleAppointment,
        status,
      }));

      const useCase = new CancelAppointmentUseCase(mockTxRunner, mockClock);
      const input: CancelAppointmentInput = {
        actorId: "cust-1",
        appointmentId: "appt-1",
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        InvalidAppointmentStatusTransitionError,
      );
    }

    expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
  });
});
