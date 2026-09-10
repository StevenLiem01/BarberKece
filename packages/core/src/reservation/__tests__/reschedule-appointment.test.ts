import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RescheduleAppointmentUseCase,
  RescheduleAppointmentInput,
} from "../use-cases/reschedule-appointment.js";
import { AppointmentStatus } from "../domain/appointment-status.js";
import type { Appointment } from "../models/appointment.js";
import type { BusinessHours } from "../models/business-hours.js";
import type { BarberSchedule } from "../models/barber-schedule.js";
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
  BarberNotWorkingError,
  BookingHorizonExceededError,
  CustomerBookingConflictError,
  InvalidAppointmentStatusTransitionError,
  InvalidBookingDateError,
  OutsideBusinessHoursError,
  RescheduleCutoffExceededError,
  ScheduleExceptionConflictError,
  SlotAlreadyBookedError,
} from "../errors.js";

describe("RescheduleAppointmentUseCase", () => {
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
    // Original: 11:00:00 Jakarta (3 hours in the future)
    startsAt: new Date("2026-09-09T04:00:00.000Z"),
    endsAt: new Date("2026-09-09T04:45:00.000Z"),
    serviceDurationMinutes: 45,
    priceRupiah: 75000,
    notes: "Special request",
    cancellationReason: null,
    isAutoAssigned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleBusinessHours: BusinessHours = {
    id: "bh-wednesday",
    dayOfWeek: 3, // Wednesday
    openTime: "09:00:00",
    closeTime: "21:00:00",
    isClosed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleBarberSchedule: BarberSchedule = {
    id: "bs-1",
    barberProfileId: "barber-1",
    dayOfWeek: 3,
    startTime: "09:00:00",
    endTime: "18:00:00",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockAppointmentRepo: Partial<AppointmentRepository>;
  let mockScheduleRepo: Partial<ScheduleRepository>;
  let mockBarberProfileRepo: Partial<BarberProfileRepository>;
  let mockTxRunner: BookingTransactionRunner;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAppointmentRepo = {
      lockAppointment: vi.fn(async () => ({ ...sampleAppointment })),
      rescheduleAppointment: vi.fn(async (_id, newStartsAt, newEndsAt) => ({
        ...sampleAppointment,
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        updatedAt: new Date(),
      })),
      findActiveByBarberAndIntervalExcluding: vi.fn(async () => []),
      findActiveByCustomerAndIntervalExcluding: vi.fn(async () => []),
    };

    mockScheduleRepo = {
      getBusinessHoursForDay: vi.fn(async () => ({ ...sampleBusinessHours })),
      getBarberSchedulesForDay: vi.fn(async () => [
        { ...sampleBarberSchedule },
      ]),
      getScheduleExceptions: vi.fn(async () => []),
    };

    mockBarberProfileRepo = {
      lockProfiles: vi.fn(async (ids) => ids),
    };

    mockTxRunner = {
      run: vi.fn(async (work) => {
        const context: BookingTransactionContext = {
          appointmentRepository: mockAppointmentRepo as AppointmentRepository,
          scheduleRepository: mockScheduleRepo as ScheduleRepository,
          barberEligibilityRepository:
            {} as unknown as BarberEligibilityRepository,
          barberProfileRepository:
            mockBarberProfileRepo as BarberProfileRepository,
          serviceRepository: {} as unknown as ServiceRepository,
          idempotencyRepository: {} as unknown as IdempotencyRepository,
        };
        return await work(context);
      }),
    };
  });

  it("successfully reschedules confirmed appointment to valid new slot and preserves fields", async () => {
    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock);
    // New slot: 14:00 Jakarta (07:00 UTC)
    const newStartsAt = new Date("2026-09-09T07:00:00.000Z");

    const input: RescheduleAppointmentInput = {
      actorId: "cust-1",
      appointmentId: "appt-1",
      newStartsAt,
    };

    const result = await useCase.execute(input);

    expect(result.appointment.startsAt).toEqual(newStartsAt);
    // 45 min duration from snapshot
    expect(result.appointment.endsAt).toEqual(
      new Date("2026-09-09T07:45:00.000Z"),
    );
    expect(result.appointment.id).toBe("appt-1");
    expect(result.appointment.bookingReference).toBe("BK-20260909-001");
    expect(result.appointment.serviceId).toBe("svc-1");
    expect(result.appointment.serviceDurationMinutes).toBe(45);
    expect(result.appointment.priceRupiah).toBe(75000);
    expect(result.appointment.barberProfileId).toBe("barber-1");
    expect(result.appointment.isAutoAssigned).toBe(false);
    expect(result.appointment.notes).toBe("Special request");

    expect(mockAppointmentRepo.lockAppointment).toHaveBeenCalledWith("appt-1");
    expect(mockBarberProfileRepo.lockProfiles).toHaveBeenCalledWith([
      "barber-1",
    ]);
    expect(mockAppointmentRepo.rescheduleAppointment).toHaveBeenCalledWith(
      "appt-1",
      newStartsAt,
      new Date("2026-09-09T07:45:00.000Z"),
    );
  });

  it("successfully handles self-overlap shift (shifting slot by 15 minutes)", async () => {
    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock);
    // Shifting from 11:00 to 11:15 Jakarta (04:15 UTC)
    const newStartsAt = new Date("2026-09-09T04:15:00.000Z");

    const input: RescheduleAppointmentInput = {
      actorId: "cust-1",
      appointmentId: "appt-1",
      newStartsAt,
    };

    const result = await useCase.execute(input);

    expect(result.appointment.startsAt).toEqual(newStartsAt);
    expect(
      mockAppointmentRepo.findActiveByBarberAndIntervalExcluding,
    ).toHaveBeenCalledWith(
      "barber-1",
      expect.anything(),
      "appt-1", // exclude self
    );
    expect(
      mockAppointmentRepo.findActiveByCustomerAndIntervalExcluding,
    ).toHaveBeenCalledWith(
      "cust-1",
      expect.anything(),
      "appt-1", // exclude self
    );
  });

  it("rejects reschedule when current appointment cutoff is exceeded (< 2 hours)", async () => {
    // Current appointment starts at 09:30 Jakarta (1.5 hours in the future)
    mockAppointmentRepo.lockAppointment = vi.fn(async () => ({
      ...sampleAppointment,
      startsAt: new Date("2026-09-09T02:30:00.000Z"),
      endsAt: new Date("2026-09-09T03:15:00.000Z"),
    }));

    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock);
    const input: RescheduleAppointmentInput = {
      actorId: "cust-1",
      appointmentId: "appt-1",
      newStartsAt: new Date("2026-09-09T07:00:00.000Z"),
    };

    await expect(useCase.execute(input)).rejects.toThrow(
      RescheduleCutoffExceededError,
    );
    expect(mockAppointmentRepo.rescheduleAppointment).not.toHaveBeenCalled();
  });

  it("rejects reschedule when actorId does not match customerId", async () => {
    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock);
    const input: RescheduleAppointmentInput = {
      actorId: "wrong-customer",
      appointmentId: "appt-1",
      newStartsAt: new Date("2026-09-09T07:00:00.000Z"),
    };

    await expect(useCase.execute(input)).rejects.toThrow(
      AppointmentOwnershipError,
    );
    expect(mockAppointmentRepo.rescheduleAppointment).not.toHaveBeenCalled();
  });

  it("rejects reschedule when appointment is not CONFIRMED", async () => {
    mockAppointmentRepo.lockAppointment = vi.fn(async () => ({
      ...sampleAppointment,
      status: AppointmentStatus.CANCELLED_BY_CUSTOMER,
    }));

    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock);
    const input: RescheduleAppointmentInput = {
      actorId: "cust-1",
      appointmentId: "appt-1",
      newStartsAt: new Date("2026-09-09T07:00:00.000Z"),
    };

    await expect(useCase.execute(input)).rejects.toThrow(
      InvalidAppointmentStatusTransitionError,
    );
    expect(mockAppointmentRepo.rescheduleAppointment).not.toHaveBeenCalled();
  });

  it("rejects no-op reschedule when newStartsAt equals current startsAt", async () => {
    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock);
    const input: RescheduleAppointmentInput = {
      actorId: "cust-1",
      appointmentId: "appt-1",
      newStartsAt: sampleAppointment.startsAt, // Same time!
    };

    await expect(useCase.execute(input)).rejects.toThrow(
      InvalidBookingDateError,
    );
    expect(mockAppointmentRepo.rescheduleAppointment).not.toHaveBeenCalled();
  });

  it("rejects target time in the past or not on 15-minute grid", async () => {
    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock);

    // Past time
    await expect(
      useCase.execute({
        actorId: "cust-1",
        appointmentId: "appt-1",
        newStartsAt: new Date("2026-09-09T00:30:00.000Z"),
      }),
    ).rejects.toThrow(InvalidBookingDateError);

    // Off-grid time (10:07)
    await expect(
      useCase.execute({
        actorId: "cust-1",
        appointmentId: "appt-1",
        newStartsAt: new Date("2026-09-09T03:07:00.000Z"),
      }),
    ).rejects.toThrow(InvalidBookingDateError);
  });

  it("rejects target time exceeding booking horizon", async () => {
    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock, {
      bookingHorizonDays: 14,
    });

    // 20 days in future
    const farFuture = new Date("2026-09-29T04:00:00.000Z");

    await expect(
      useCase.execute({
        actorId: "cust-1",
        appointmentId: "appt-1",
        newStartsAt: farFuture,
      }),
    ).rejects.toThrow(BookingHorizonExceededError);
  });

  it("rejects reschedule when target interval is outside business hours", async () => {
    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock);
    // 21:30 Jakarta (outside 09:00 - 21:00)
    const lateTime = new Date("2026-09-09T14:30:00.000Z");

    await expect(
      useCase.execute({
        actorId: "cust-1",
        appointmentId: "appt-1",
        newStartsAt: lateTime,
      }),
    ).rejects.toThrow(OutsideBusinessHoursError);
  });

  it("rejects reschedule when barber is not working or has schedule exception", async () => {
    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock);
    const newStartsAt = new Date("2026-09-09T07:00:00.000Z");

    // Barber not working
    mockScheduleRepo.getBarberSchedulesForDay = vi.fn(async () => []);
    await expect(
      useCase.execute({
        actorId: "cust-1",
        appointmentId: "appt-1",
        newStartsAt,
      }),
    ).rejects.toThrow(BarberNotWorkingError);

    // Barber has exception
    mockScheduleRepo.getBarberSchedulesForDay = vi.fn(async () => [
      { ...sampleBarberSchedule },
    ]);
    mockScheduleRepo.getScheduleExceptions = vi.fn(async () => [
      {
        id: "exc-1",
        barberProfileId: "barber-1",
        startsAt: newStartsAt,
        endsAt: new Date("2026-09-09T08:00:00.000Z"),
        reason: "Medical leave",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await expect(
      useCase.execute({
        actorId: "cust-1",
        appointmentId: "appt-1",
        newStartsAt,
      }),
    ).rejects.toThrow(ScheduleExceptionConflictError);
  });

  it("rejects reschedule when barber or customer has conflicting appointment in target slot", async () => {
    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock);
    const newStartsAt = new Date("2026-09-09T07:00:00.000Z");

    // Barber overlap with different appointment
    mockAppointmentRepo.findActiveByBarberAndIntervalExcluding = vi.fn(
      async () => [
        {
          ...sampleAppointment,
          id: "appt-other",
          startsAt: newStartsAt,
          endsAt: new Date("2026-09-09T07:45:00.000Z"),
        },
      ],
    );

    await expect(
      useCase.execute({
        actorId: "cust-1",
        appointmentId: "appt-1",
        newStartsAt,
      }),
    ).rejects.toThrow(SlotAlreadyBookedError);

    // Customer overlap with different appointment
    mockAppointmentRepo.findActiveByBarberAndIntervalExcluding = vi.fn(
      async () => [],
    );
    mockAppointmentRepo.findActiveByCustomerAndIntervalExcluding = vi.fn(
      async () => [
        {
          ...sampleAppointment,
          id: "appt-other-cust",
          startsAt: newStartsAt,
          endsAt: new Date("2026-09-09T07:45:00.000Z"),
        },
      ],
    );

    await expect(
      useCase.execute({
        actorId: "cust-1",
        appointmentId: "appt-1",
        newStartsAt,
      }),
    ).rejects.toThrow(CustomerBookingConflictError);
  });

  it("rejects when appointment does not exist", async () => {
    mockAppointmentRepo.lockAppointment = vi.fn(async () => null);

    const useCase = new RescheduleAppointmentUseCase(mockTxRunner, mockClock);
    await expect(
      useCase.execute({
        actorId: "cust-1",
        appointmentId: "non-existent",
        newStartsAt: new Date("2026-09-09T07:00:00.000Z"),
      }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });
});
