import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TransitionAppointmentStatusUseCase,
  TransitionAppointmentStatusInput,
} from "../use-cases/transition-appointment-status.js";
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
  CancellationReasonRequiredError,
  InvalidAppointmentStatusTransitionError,
  NoShowGracePeriodNotElapsedError,
} from "../errors.js";

describe("TransitionAppointmentStatusUseCase", () => {
  // Appointment start: 10:00:00 UTC
  const APPT_START = new Date("2026-09-15T10:00:00.000Z");
  const APPT_END = new Date("2026-09-15T10:45:00.000Z");

  const sampleAppointment: Appointment = {
    id: "appt-1",
    bookingReference: "BK-20260915-001",
    customerId: "cust-1",
    barberProfileId: "barber-1",
    serviceId: "svc-1",
    status: AppointmentStatus.CONFIRMED,
    startsAt: APPT_START,
    endsAt: APPT_END,
    serviceDurationMinutes: 45,
    priceRupiah: 75000,
    notes: null,
    cancellationReason: null,
    isAutoAssigned: false,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
  };

  let mockAppointmentRepo: Partial<AppointmentRepository>;
  let mockTxRunner: BookingTransactionRunner;
  let mockClock: Clock;
  let currentTime: Date;

  beforeEach(() => {
    vi.clearAllMocks();
    currentTime = new Date("2026-09-15T10:05:00.000Z");

    mockClock = {
      now: vi.fn(() => currentTime),
    };

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

  describe("Canonical Barber Allowed Transitions", () => {
    it("transitions CONFIRMED -> CHECKED_IN successfully", async () => {
      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.CHECKED_IN,
      };

      const result = await useCase.execute(input);

      expect(result.appointment.status).toBe(AppointmentStatus.CHECKED_IN);
      expect(mockAppointmentRepo.lockAppointment).toHaveBeenCalledWith(
        "appt-1",
      );
      expect(mockAppointmentRepo.updateStatus).toHaveBeenCalledWith(
        "appt-1",
        AppointmentStatus.CHECKED_IN,
        undefined,
      );
    });

    it("transitions CHECKED_IN -> IN_SERVICE successfully", async () => {
      mockAppointmentRepo.lockAppointment = vi.fn(async () => ({
        ...sampleAppointment,
        status: AppointmentStatus.CHECKED_IN,
      }));

      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.IN_SERVICE,
      };

      const result = await useCase.execute(input);

      expect(result.appointment.status).toBe(AppointmentStatus.IN_SERVICE);
      expect(mockAppointmentRepo.updateStatus).toHaveBeenCalledWith(
        "appt-1",
        AppointmentStatus.IN_SERVICE,
        undefined,
      );
    });

    it("transitions IN_SERVICE -> COMPLETED successfully", async () => {
      mockAppointmentRepo.lockAppointment = vi.fn(async () => ({
        ...sampleAppointment,
        status: AppointmentStatus.IN_SERVICE,
      }));

      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.COMPLETED,
      };

      const result = await useCase.execute(input);

      expect(result.appointment.status).toBe(AppointmentStatus.COMPLETED);
      expect(mockAppointmentRepo.updateStatus).toHaveBeenCalledWith(
        "appt-1",
        AppointmentStatus.COMPLETED,
        undefined,
      );
    });

    it("transitions CONFIRMED -> CANCELLED_BY_BARBERSHOP successfully with trimmed reason", async () => {
      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.CANCELLED_BY_BARBERSHOP,
        cancellationReason: "  Emergency equipment maintenance  ",
      };

      const result = await useCase.execute(input);

      expect(result.appointment.status).toBe(
        AppointmentStatus.CANCELLED_BY_BARBERSHOP,
      );
      expect(mockAppointmentRepo.updateStatus).toHaveBeenCalledWith(
        "appt-1",
        AppointmentStatus.CANCELLED_BY_BARBERSHOP,
        "Emergency equipment maintenance",
      );
    });

    it("transitions CHECKED_IN -> CANCELLED_BY_BARBERSHOP successfully with reason", async () => {
      mockAppointmentRepo.lockAppointment = vi.fn(async () => ({
        ...sampleAppointment,
        status: AppointmentStatus.CHECKED_IN,
      }));

      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.CANCELLED_BY_BARBERSHOP,
        cancellationReason: "Customer felt unwell during check-in",
      };

      const result = await useCase.execute(input);

      expect(result.appointment.status).toBe(
        AppointmentStatus.CANCELLED_BY_BARBERSHOP,
      );
      expect(mockAppointmentRepo.updateStatus).toHaveBeenCalledWith(
        "appt-1",
        AppointmentStatus.CANCELLED_BY_BARBERSHOP,
        "Customer felt unwell during check-in",
      );
    });
  });

  describe("NO_SHOW Grace Period Policy", () => {
    it("transitions CONFIRMED -> NO_SHOW when exactly at the 15-minute grace period boundary", async () => {
      // 10:15:00 UTC (exact threshold)
      currentTime = new Date("2026-09-15T10:15:00.000Z");

      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.NO_SHOW,
      };

      const result = await useCase.execute(input);

      expect(result.appointment.status).toBe(AppointmentStatus.NO_SHOW);
      expect(mockAppointmentRepo.updateStatus).toHaveBeenCalledWith(
        "appt-1",
        AppointmentStatus.NO_SHOW,
        undefined,
      );
    });

    it("transitions CONFIRMED -> NO_SHOW when well past the 15-minute grace period", async () => {
      // 10:25:00 UTC
      currentTime = new Date("2026-09-15T10:25:00.000Z");

      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.NO_SHOW,
      };

      const result = await useCase.execute(input);

      expect(result.appointment.status).toBe(AppointmentStatus.NO_SHOW);
    });

    it("rejects CONFIRMED -> NO_SHOW 1ms before the 15-minute threshold", async () => {
      // 10:14:59.999 UTC
      currentTime = new Date("2026-09-15T10:14:59.999Z");

      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.NO_SHOW,
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        NoShowGracePeriodNotElapsedError,
      );
      expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects CONFIRMED -> NO_SHOW before appointment startsAt", async () => {
      // 09:55:00 UTC (5 mins before start)
      currentTime = new Date("2026-09-15T09:55:00.000Z");

      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.NO_SHOW,
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        NoShowGracePeriodNotElapsedError,
      );
      expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("CANCELLED_BY_BARBERSHOP Reason Requirement", () => {
    it("rejects cancellation when cancellationReason is omitted", async () => {
      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.CANCELLED_BY_BARBERSHOP,
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        CancellationReasonRequiredError,
      );
      expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects cancellation when cancellationReason is only whitespace", async () => {
      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.CANCELLED_BY_BARBERSHOP,
        cancellationReason: "     ",
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        CancellationReasonRequiredError,
      );
      expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("does not pass cancellationReason when targetStatus is not CANCELLED_BY_BARBERSHOP", async () => {
      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.CHECKED_IN,
        cancellationReason: "Erroneously passed reason",
      };

      await useCase.execute(input);

      expect(mockAppointmentRepo.updateStatus).toHaveBeenCalledWith(
        "appt-1",
        AppointmentStatus.CHECKED_IN,
        undefined,
      );
    });
  });

  describe("Ownership and Isolation", () => {
    it("rejects transition when barberProfileId does not match the assigned barber", async () => {
      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "another-barber",
        targetStatus: AppointmentStatus.CHECKED_IN,
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        AppointmentOwnershipError,
      );
      expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects transition when appointment is not found", async () => {
      mockAppointmentRepo.lockAppointment = vi.fn(async () => null);

      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-unknown",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.CHECKED_IN,
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        AppointmentNotFoundError,
      );
      expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("Forbidden Transitions and Terminal States", () => {
    it("rejects direct transition from CONFIRMED -> COMPLETED", async () => {
      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.COMPLETED,
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        InvalidAppointmentStatusTransitionError,
      );
      expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects backward transition from IN_SERVICE -> CHECKED_IN", async () => {
      mockAppointmentRepo.lockAppointment = vi.fn(async () => ({
        ...sampleAppointment,
        status: AppointmentStatus.IN_SERVICE,
      }));

      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.CHECKED_IN,
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        InvalidAppointmentStatusTransitionError,
      );
      expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects transitions from terminal states", async () => {
      const terminalStatuses = [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED_BY_CUSTOMER,
        AppointmentStatus.CANCELLED_BY_BARBERSHOP,
        AppointmentStatus.NO_SHOW,
      ];

      for (const terminalStatus of terminalStatuses) {
        mockAppointmentRepo.lockAppointment = vi.fn(async () => ({
          ...sampleAppointment,
          status: terminalStatus,
        }));

        const useCase = new TransitionAppointmentStatusUseCase(
          mockTxRunner,
          mockClock,
        );
        const input: TransitionAppointmentStatusInput = {
          appointmentId: "appt-1",
          barberProfileId: "barber-1",
          targetStatus: AppointmentStatus.IN_SERVICE,
        };

        await expect(useCase.execute(input)).rejects.toThrow(
          InvalidAppointmentStatusTransitionError,
        );
      }

      expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects transition to CANCELLED_BY_CUSTOMER as it is not a valid barber operational transition", async () => {
      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      const input: TransitionAppointmentStatusInput = {
        appointmentId: "appt-1",
        barberProfileId: "barber-1",
        targetStatus: AppointmentStatus.CANCELLED_BY_CUSTOMER,
      };

      await expect(useCase.execute(input)).rejects.toThrow(
        InvalidAppointmentStatusTransitionError,
      );
      expect(mockAppointmentRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe("Input Validation", () => {
    it("rejects missing appointmentId", async () => {
      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      await expect(
        useCase.execute({
          appointmentId: "",
          barberProfileId: "barber-1",
          targetStatus: AppointmentStatus.CHECKED_IN,
        }),
      ).rejects.toThrow("appointmentId is required");
    });

    it("rejects missing barberProfileId", async () => {
      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      await expect(
        useCase.execute({
          appointmentId: "appt-1",
          barberProfileId: "",
          targetStatus: AppointmentStatus.CHECKED_IN,
        }),
      ).rejects.toThrow("barberProfileId is required");
    });

    it("rejects missing targetStatus", async () => {
      const useCase = new TransitionAppointmentStatusUseCase(
        mockTxRunner,
        mockClock,
      );
      await expect(
        useCase.execute({
          appointmentId: "appt-1",
          barberProfileId: "barber-1",
          targetStatus: "" as AppointmentStatus,
        }),
      ).rejects.toThrow("targetStatus is required");
    });
  });
});
