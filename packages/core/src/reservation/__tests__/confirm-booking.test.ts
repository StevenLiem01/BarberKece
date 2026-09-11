import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConfirmBookingUseCase,
  ConfirmBookingInput,
} from "../use-cases/confirm-booking.js";
import { AppointmentStatus } from "../domain/appointment-status.js";
import type { Appointment } from "../models/appointment.js";
import type { Service } from "../models/service.js";
import type { BusinessHours } from "../models/business-hours.js";
import type { BarberSchedule } from "../models/barber-schedule.js";
import type {
  AppointmentRepository,
  BarberWorkloadSummary,
} from "../ports/appointment-repository.js";
import type { ScheduleRepository } from "../ports/schedule-repository.js";
import type { BarberEligibilityRepository } from "../ports/barber-eligibility-repository.js";
import type { ServiceRepository } from "../ports/service-repository.js";
import type { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";
import type {
  IdempotencyRepository,
  IdempotencyRecord,
} from "../ports/idempotency-repository.js";
import type {
  BookingTransactionRunner,
  BookingTransactionContext,
} from "../ports/booking-transaction-runner.js";
import type { Clock } from "../ports/clock.js";
import type { BookingReferenceGenerator } from "../domain/booking-reference.js";
import {
  BarberNotEligibleError,
  BarberNotWorkingError,
  BookingHorizonExceededError,
  CustomerBookingConflictError,
  IdempotencyPayloadMismatchError,
  InactiveServiceError,
  InvalidBookingDateError,
  OutsideBusinessHoursError,
  ScheduleExceptionConflictError,
  ServiceNotFoundError,
  SlotAlreadyBookedError,
} from "../errors.js";
import { BarberProfileNotFoundError } from "../../barber/errors.js";

describe("ConfirmBookingUseCase", () => {
  // Asia/Jakarta is UTC+07:00
  // Reference now: Wednesday 2026-09-09 08:00:00 Jakarta (01:00:00 UTC)
  const FIXED_NOW = new Date("2026-09-09T01:00:00.000Z");

  const mockClock: Clock = {
    now: vi.fn(() => FIXED_NOW),
  };

  const mockReferenceGenerator: BookingReferenceGenerator = {
    generate: vi.fn(() => "BK-20260909-TEST01"),
  };

  const sampleService: Service = {
    id: "svc-haircut",
    name: "Classic Haircut",
    description: "Standard haircut",
    durationMinutes: 45,
    priceRupiah: 75000,
    isActive: true,
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

  let mockAppointmentRepo: AppointmentRepository;
  let mockScheduleRepo: ScheduleRepository;
  let mockEligibilityRepo: BarberEligibilityRepository;
  let mockBarberProfileRepo: BarberProfileRepository;
  let mockServiceRepo: ServiceRepository;
  let mockIdempotencyRepo: IdempotencyRepository;
  let mockTxRunner: BookingTransactionRunner;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAppointmentRepo = {
      createAppointment: vi.fn(),
      createConfirmedAppointmentWithRetry: vi.fn(
        async (params, generateRef) => {
          return {
            id: params.id ?? "appt-created-1",
            bookingReference: generateRef(),
            customerId: params.customerId,
            barberProfileId: params.barberProfileId,
            serviceId: params.serviceId,
            status: AppointmentStatus.CONFIRMED,
            startsAt: params.startsAt,
            endsAt: params.endsAt,
            serviceDurationMinutes: params.serviceDurationMinutes,
            priceRupiah: params.priceRupiah,
            notes: params.notes ?? null,
            cancellationReason: null,
            isAutoAssigned: params.isAutoAssigned ?? false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      ),
      findById: vi.fn(async () => null),
      findByBookingReference: vi.fn(async () => null),
      findByCustomerId: vi.fn(async () => []),
      findByBarberId: vi.fn(async () => []),
      updateStatus: vi.fn(),
      findActiveByBarberAndInterval: vi.fn(async () => []),
      findActiveByCustomerAndInterval: vi.fn(async () => []),
      findActiveByBarberAndIntervalExcluding: vi.fn(async () => []),
      findActiveByCustomerAndIntervalExcluding: vi.fn(async () => []),
      lockAppointment: vi.fn(async () => null),
      rescheduleAppointment: vi.fn(async () => ({}) as Appointment),
      getBarberDailyWorkloads: vi.fn(async () => []),
    };

    mockScheduleRepo = {
      getBusinessHours: vi.fn(),
      getBusinessHoursForDay: vi.fn(async () => sampleBusinessHours),
      upsertBusinessHours: vi.fn(),
      getBarberSchedules: vi.fn(),
      getBarberSchedulesForDay: vi.fn(async () => [sampleBarberSchedule]),
      createBarberSchedule: vi.fn(),
      getScheduleExceptions: vi.fn(async () => []),
      createScheduleException: vi.fn(),
    };

    mockEligibilityRepo = {
      assignService: vi.fn(),
      removeService: vi.fn(),
      findServicesByBarberId: vi.fn(),
      isEligible: vi.fn(async () => true),
      findEligibleBarberProfileIds: vi.fn(async () => ["barber-1"]),
    };

    mockBarberProfileRepo = {
      provisionProfile: vi.fn(),
      updateSpecialization: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findAll: vi.fn(),
      lockProfiles: vi.fn(async (ids) => ids),
    };

    mockServiceRepo = {
      createService: vi.fn(),
      updateService: vi.fn(),
      updateServiceStatus: vi.fn(),
      findById: vi.fn(async () => sampleService),
      findActive: vi.fn(),
      findAll: vi.fn(),
    };

    mockIdempotencyRepo = {
      acquireAdvisoryLock: vi.fn(async () => {}),
      findByKey: vi.fn(async () => null),
      createRecord: vi.fn(async (params) => ({
        id: "idem-1",
        ...params,
        createdAt: new Date(),
      })),
    };

    mockTxRunner = {
      run: vi.fn(async (work) => {
        const context: BookingTransactionContext = {
          appointmentRepository: mockAppointmentRepo,
          scheduleRepository: mockScheduleRepo,
          barberEligibilityRepository: mockEligibilityRepo,
          barberProfileRepository: mockBarberProfileRepo,
          serviceRepository: mockServiceRepo,
          idempotencyRepository: mockIdempotencyRepo,
        };
        return await work(context);
      }),
    };
  });

  function createUseCase(options?: { bookingHorizonDays?: number }) {
    return new ConfirmBookingUseCase(mockTxRunner, mockClock, {
      referenceGenerator: mockReferenceGenerator,
      bookingHorizonDays: options?.bookingHorizonDays,
    });
  }

  it("successfully confirms booking with Specific Barber mode and snapshots duration/price", async () => {
    const useCase = createUseCase();
    // 2026-09-09 10:00:00 Jakarta is 2026-09-09 03:00:00 UTC
    const startsAt = new Date("2026-09-09T03:00:00.000Z");

    const input: ConfirmBookingInput = {
      actorId: "user-cust-1",
      customerId: "user-cust-1",
      serviceId: "svc-haircut",
      startsAt,
      barberProfileId: "barber-1",
      notes: "Please leave top longer",
    };

    const result = await useCase.execute(input);

    expect(result.isIdempotentReplay).toBe(false);
    expect(result.appointment).toBeDefined();
    expect(result.appointment.status).toBe(AppointmentStatus.CONFIRMED);
    expect(result.appointment.barberProfileId).toBe("barber-1");
    expect(result.appointment.serviceDurationMinutes).toBe(45);
    expect(result.appointment.priceRupiah).toBe(75000);
    // endsAt is 10:00 + 45 min = 10:45 (03:45 UTC)
    expect(result.appointment.endsAt).toEqual(
      new Date("2026-09-09T03:45:00.000Z"),
    );
    expect(result.appointment.isAutoAssigned).toBe(false);
    expect(result.appointment.bookingReference).toBe("BK-20260909-TEST01");

    expect(mockBarberProfileRepo.lockProfiles).toHaveBeenCalledWith([
      "barber-1",
    ]);
  });

  it("successfully confirms booking with ANY_AVAILABLE mode using FairnessSelector", async () => {
    const useCase = createUseCase();
    const startsAt = new Date("2026-09-09T03:00:00.000Z");

    (
      mockEligibilityRepo.findEligibleBarberProfileIds as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValueOnce(["barber-1", "barber-2"]);

    (
      mockBarberProfileRepo.lockProfiles as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(["barber-1", "barber-2"]);

    // Both barbers working and free
    (
      mockScheduleRepo.getBarberSchedulesForDay as ReturnType<typeof vi.fn>
    ).mockImplementation(async (barberId: string) => [
      {
        ...sampleBarberSchedule,
        barberProfileId: barberId,
      },
    ]);

    // Workload: barber-2 has lower booked minutes
    const workloads: BarberWorkloadSummary[] = [
      {
        barberProfileId: "barber-1",
        bookedServiceMinutes: 90,
        lastAutoAssignedAt: null,
      },
      {
        barberProfileId: "barber-2",
        bookedServiceMinutes: 30,
        lastAutoAssignedAt: null,
      },
    ];
    (
      mockAppointmentRepo.getBarberDailyWorkloads as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(workloads);

    const input: ConfirmBookingInput = {
      actorId: "user-cust-1",
      customerId: "user-cust-1",
      serviceId: "svc-haircut",
      startsAt,
      barberProfileId: null, // ANY_AVAILABLE
    };

    const result = await useCase.execute(input);

    expect(result.appointment.barberProfileId).toBe("barber-2");
    expect(result.appointment.isAutoAssigned).toBe(true);
  });

  it("rejects booking if startsAt is in the past", async () => {
    const useCase = createUseCase();
    // In the past relative to FIXED_NOW (01:00 UTC)
    const startsAt = new Date("2026-09-09T00:45:00.000Z");

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt,
      }),
    ).rejects.toThrow(InvalidBookingDateError);
  });

  it("rejects booking if startsAt is not on a 15-minute grid boundary", async () => {
    const useCase = createUseCase();
    // 03:07:00 UTC is not on :00, :15, :30, :45
    const startsAt = new Date("2026-09-09T03:07:00.000Z");

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt,
      }),
    ).rejects.toThrow("Appointment start time must be on a 15-minute boundary");
  });

  it("rejects booking if target date exceeds configured horizon", async () => {
    const useCase = createUseCase({ bookingHorizonDays: 14 });
    // 20 days ahead
    const startsAt = new Date("2026-09-29T03:00:00.000Z");

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt,
      }),
    ).rejects.toThrow(BookingHorizonExceededError);
  });

  it("rejects booking if service is not found", async () => {
    const useCase = createUseCase();
    (
      mockServiceRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "missing-service",
        startsAt: new Date("2026-09-09T03:00:00.000Z"),
      }),
    ).rejects.toThrow(ServiceNotFoundError);
  });

  it("rejects booking if service is inactive", async () => {
    const useCase = createUseCase();
    (
      mockServiceRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({
      ...sampleService,
      isActive: false,
    });

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt: new Date("2026-09-09T03:00:00.000Z"),
      }),
    ).rejects.toThrow(InactiveServiceError);
  });

  it("rejects booking if requested time falls outside business hours", async () => {
    const useCase = createUseCase();
    // Shop opens at 09:00 Jakarta (02:00 UTC). Request is at 08:30 Jakarta (01:30 UTC).
    const startsAt = new Date("2026-09-09T01:30:00.000Z");

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt,
      }),
    ).rejects.toThrow(OutsideBusinessHoursError);
  });

  it("rejects booking if customer has an active overlapping appointment", async () => {
    const useCase = createUseCase();
    const startsAt = new Date("2026-09-09T03:00:00.000Z");

    (
      mockAppointmentRepo.findActiveByCustomerAndInterval as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValueOnce([
      {
        id: "existing-appt",
        status: AppointmentStatus.CONFIRMED,
      } as Appointment,
    ]);

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt,
      }),
    ).rejects.toThrow(CustomerBookingConflictError);
  });

  it("rejects Specific Barber booking if barber profile does not exist", async () => {
    const useCase = createUseCase();
    (
      mockBarberProfileRepo.lockProfiles as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([]); // empty lock -> missing profile

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt: new Date("2026-09-09T03:00:00.000Z"),
        barberProfileId: "barber-missing",
      }),
    ).rejects.toThrow(BarberProfileNotFoundError);
  });

  it("rejects Specific Barber booking if barber is not eligible for service", async () => {
    const useCase = createUseCase();
    (
      mockEligibilityRepo.isEligible as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce(false);

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt: new Date("2026-09-09T03:00:00.000Z"),
        barberProfileId: "barber-1",
      }),
    ).rejects.toThrow(BarberNotEligibleError);
  });

  it("rejects Specific Barber booking if barber is not working during requested time", async () => {
    const useCase = createUseCase();
    // Shift ends at 18:00 Jakarta (11:00 UTC). Request is at 18:00 Jakarta -> interval [18:00, 18:45)
    (
      mockScheduleRepo.getBarberSchedulesForDay as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([]); // no shift

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt: new Date("2026-09-09T03:00:00.000Z"),
        barberProfileId: "barber-1",
      }),
    ).rejects.toThrow(BarberNotWorkingError);
  });

  it("rejects Specific Barber booking if conflicting with schedule exception", async () => {
    const useCase = createUseCase();
    (
      mockScheduleRepo.getScheduleExceptions as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([
      {
        id: "exc-1",
        reason: "Barber emergency leave",
        startsAt: new Date("2026-09-09T02:00:00.000Z"),
        endsAt: new Date("2026-09-09T06:00:00.000Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt: new Date("2026-09-09T03:00:00.000Z"),
        barberProfileId: "barber-1",
      }),
    ).rejects.toThrow(ScheduleExceptionConflictError);
  });

  it("rejects Specific Barber booking if slot already booked", async () => {
    const useCase = createUseCase();
    (
      mockAppointmentRepo.findActiveByBarberAndInterval as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValueOnce([
      {
        id: "existing-appt",
        status: AppointmentStatus.CONFIRMED,
      } as Appointment,
    ]);

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt: new Date("2026-09-09T03:00:00.000Z"),
        barberProfileId: "barber-1",
      }),
    ).rejects.toThrow(SlotAlreadyBookedError);
  });

  it("rejects ANY_AVAILABLE booking if no eligible barbers are available", async () => {
    const useCase = createUseCase();
    (
      mockEligibilityRepo.findEligibleBarberProfileIds as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValueOnce(["barber-1"]);
    // Barber 1 has an active appointment
    (
      mockAppointmentRepo.findActiveByBarberAndInterval as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValueOnce([
      {
        id: "existing-appt",
        status: AppointmentStatus.CONFIRMED,
      } as Appointment,
    ]);

    await expect(
      useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt: new Date("2026-09-09T03:00:00.000Z"),
      }),
    ).rejects.toThrow(SlotAlreadyBookedError);
  });

  describe("Idempotency", () => {
    it("returns existing appointment with isIdempotentReplay = true on same actor + operation + key + same payload", async () => {
      const useCase = createUseCase();
      const startsAt = new Date("2026-09-09T03:00:00.000Z");

      const existingAppointment: Appointment = {
        id: "appt-replay-1",
        bookingReference: "BK-20260909-EXIST1",
        customerId: "cust-1",
        barberProfileId: "barber-1",
        serviceId: "svc-haircut",
        status: AppointmentStatus.CONFIRMED,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 45 * 60 * 1000),
        serviceDurationMinutes: 45,
        priceRupiah: 75000,
        notes: null,
        cancellationReason: null,
        isAutoAssigned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock finding existing idempotency record with matching hash
      const { computeBookingRequestHash } =
        await import("../use-cases/confirm-booking.js");
      const expectedHash = computeBookingRequestHash({
        serviceId: "svc-haircut",
        startsAt,
        barberProfileId: "barber-1",
        notes: null,
      });

      const existingRecord: IdempotencyRecord = {
        id: "idem-rec-1",
        actorId: "cust-1",
        operation: "CONFIRM_BOOKING",
        idempotencyKey: "idem-key-abc",
        requestHash: expectedHash,
        appointmentId: "appt-replay-1",
        createdAt: new Date(),
      };

      (
        mockIdempotencyRepo.findByKey as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(existingRecord);
      (
        mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(existingAppointment);

      const result = await useCase.execute({
        actorId: "cust-1",
        customerId: "cust-1",
        serviceId: "svc-haircut",
        startsAt,
        barberProfileId: "barber-1",
        idempotencyKey: "idem-key-abc",
      });

      expect(mockIdempotencyRepo.acquireAdvisoryLock).toHaveBeenCalledWith(
        "cust-1",
        "CONFIRM_BOOKING",
        "idem-key-abc",
      );
      expect(result.isIdempotentReplay).toBe(true);
      expect(result.appointment.id).toBe("appt-replay-1");
      expect(
        mockAppointmentRepo.createConfirmedAppointmentWithRetry,
      ).not.toHaveBeenCalled();
    });

    it("throws IdempotencyPayloadMismatchError on same actor + operation + key with different payload", async () => {
      const useCase = createUseCase();
      const startsAt = new Date("2026-09-09T03:00:00.000Z");

      const existingRecord: IdempotencyRecord = {
        id: "idem-rec-1",
        actorId: "cust-1",
        operation: "CONFIRM_BOOKING",
        idempotencyKey: "idem-key-abc",
        requestHash: "different-request-hash-123456",
        appointmentId: "appt-other",
        createdAt: new Date(),
      };

      (
        mockIdempotencyRepo.findByKey as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(existingRecord);

      await expect(
        useCase.execute({
          actorId: "cust-1",
          customerId: "cust-1",
          serviceId: "svc-haircut",
          startsAt,
          barberProfileId: "barber-1",
          idempotencyKey: "idem-key-abc",
        }),
      ).rejects.toThrow(IdempotencyPayloadMismatchError);
    });
  });
});
