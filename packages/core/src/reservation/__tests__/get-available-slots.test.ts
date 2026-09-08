import { describe, it, expect, beforeEach } from "vitest";
import {
  GetAvailableSlotsUseCase,
  AvailabilityConfig,
} from "../use-cases/get-available-slots.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";
import { BarberEligibilityRepository } from "../ports/barber-eligibility-repository.js";
import { ScheduleRepository } from "../ports/schedule-repository.js";
import { AppointmentRepository } from "../ports/appointment-repository.js";
import { Clock } from "../ports/clock.js";
import { Service } from "../models/service.js";
import { BarberProfile } from "../../barber/models/barber-profile.js";
import { BusinessHours } from "../models/business-hours.js";
import { BarberSchedule } from "../models/barber-schedule.js";
import {
  BarberNotEligibleError,
  BookingHorizonExceededError,
  InactiveServiceError,
  InvalidBookingDateError,
  InvalidBookingHorizonConfigError,
  ServiceNotFoundError,
} from "../errors.js";
import { BarberProfileNotFoundError } from "../../barber/errors.js";

describe("GetAvailableSlotsUseCase", () => {
  let mockServiceRepo: Partial<ServiceRepository>;
  let mockBarberProfileRepo: Partial<BarberProfileRepository>;
  let mockBarberEligibilityRepo: Partial<BarberEligibilityRepository>;
  let mockScheduleRepo: Partial<ScheduleRepository>;
  let mockAppointmentRepo: Partial<AppointmentRepository>;
  let mockClock: Clock;

  const fixedNow = new Date("2026-09-08T08:00:00.000+07:00"); // 2026-09-08 08:00 WIB
  const validDate = "2026-09-08"; // Tuesday (dayOfWeek: 2)

  const activeService: Service = {
    id: "svc-active",
    name: "Classic Cut",
    description: "Regular haircut",
    priceRupiah: 60000,
    durationMinutes: 30,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const barberProfile1: BarberProfile = {
    id: "barber-1",
    userId: "user-1",
    specialization: "Classic fades",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const barberProfile2: BarberProfile = {
    id: "barber-2",
    userId: "user-2",
    specialization: "Beard styling",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const shopBusinessHours: BusinessHours = {
    id: "bh-1",
    dayOfWeek: 2,
    openTime: "09:00:00",
    closeTime: "12:00:00",
    isClosed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const barber1Schedule: BarberSchedule = {
    id: "bs-1",
    barberProfileId: "barber-1",
    dayOfWeek: 2,
    startTime: "09:00:00",
    endTime: "11:00:00",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const barber2Schedule: BarberSchedule = {
    id: "bs-2",
    barberProfileId: "barber-2",
    dayOfWeek: 2,
    startTime: "10:00:00",
    endTime: "12:00:00",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockClock = {
      now: () => fixedNow,
    };

    mockServiceRepo = {
      findById: async (id: string) => {
        if (id === activeService.id) return activeService;
        return null;
      },
    };

    mockBarberProfileRepo = {
      findById: async (id: string) => {
        if (id === "barber-1") return barberProfile1;
        if (id === "barber-2") return barberProfile2;
        return null;
      },
    };

    mockBarberEligibilityRepo = {
      isEligible: async (barberId: string, serviceId: string) => {
        if (serviceId === activeService.id) {
          return barberId === "barber-1" || barberId === "barber-2";
        }
        return false;
      },
      findEligibleBarberProfileIds: async (serviceId: string) => {
        if (serviceId === activeService.id) {
          return ["barber-1", "barber-2"];
        }
        return [];
      },
    };

    mockScheduleRepo = {
      getBusinessHoursForDay: async (dayOfWeek: number) => {
        if (dayOfWeek === 2) return shopBusinessHours;
        return null;
      },
      getBarberSchedulesForDay: async (barberId: string) => {
        if (barberId === "barber-1") return [barber1Schedule];
        if (barberId === "barber-2") return [barber2Schedule];
        return [];
      },
      getScheduleExceptions: async () => [],
    };

    mockAppointmentRepo = {
      findActiveByBarberAndInterval: async () => [],
    };
  });

  it("throws InvalidBookingHorizonConfigError for horizon outside 7-90 days", () => {
    expect(() => new AvailabilityConfig(6)).toThrow(
      InvalidBookingHorizonConfigError,
    );
    expect(() => new AvailabilityConfig(91)).toThrow(
      InvalidBookingHorizonConfigError,
    );
    expect(() => new AvailabilityConfig(30.5)).toThrow(
      InvalidBookingHorizonConfigError,
    );

    // Valid configs
    expect(new AvailabilityConfig(7).bookingHorizonDays).toBe(7);
    expect(new AvailabilityConfig(90).bookingHorizonDays).toBe(90);
    expect(new AvailabilityConfig().bookingHorizonDays).toBe(30);
  });

  it("throws InvalidBookingDateError on malformed or past dates", async () => {
    const useCase = new GetAvailableSlotsUseCase(
      mockServiceRepo as ServiceRepository,
      mockBarberProfileRepo as BarberProfileRepository,
      mockBarberEligibilityRepo as BarberEligibilityRepository,
      mockScheduleRepo as ScheduleRepository,
      mockAppointmentRepo as AppointmentRepository,
      mockClock,
    );

    await expect(
      useCase.execute({
        serviceId: activeService.id,
        date: "invalid-date",
      }),
    ).rejects.toThrow(InvalidBookingDateError);

    await expect(
      useCase.execute({
        serviceId: activeService.id,
        date: "2026-09-07", // Yesterday relative to 2026-09-08
      }),
    ).rejects.toThrow(InvalidBookingDateError);
  });

  it("enforces default booking horizon (30 days)", async () => {
    const useCase = new GetAvailableSlotsUseCase(
      mockServiceRepo as ServiceRepository,
      mockBarberProfileRepo as BarberProfileRepository,
      mockBarberEligibilityRepo as BarberEligibilityRepository,
      mockScheduleRepo as ScheduleRepository,
      mockAppointmentRepo as AppointmentRepository,
      mockClock,
      new AvailabilityConfig(30),
    );

    // 2026-09-08 + 30 days = 2026-10-08
    // 2026-10-08 is within horizon (should succeed validation)
    const withinHorizonResult = await useCase.execute({
      serviceId: activeService.id,
      date: "2026-10-08",
    });
    expect(withinHorizonResult.date).toBe("2026-10-08");

    // 2026-10-09 exceeds 30 days -> throws BookingHorizonExceededError
    await expect(
      useCase.execute({
        serviceId: activeService.id,
        date: "2026-10-09",
      }),
    ).rejects.toThrow(BookingHorizonExceededError);
  });

  it("enforces custom booking horizon (e.g. 60 days)", async () => {
    const useCase = new GetAvailableSlotsUseCase(
      mockServiceRepo as ServiceRepository,
      mockBarberProfileRepo as BarberProfileRepository,
      mockBarberEligibilityRepo as BarberEligibilityRepository,
      mockScheduleRepo as ScheduleRepository,
      mockAppointmentRepo as AppointmentRepository,
      mockClock,
      new AvailabilityConfig(60),
    );

    // 2026-09-08 + 60 days = 2026-11-07
    const result = await useCase.execute({
      serviceId: activeService.id,
      date: "2026-11-07",
    });
    expect(result.date).toBe("2026-11-07");

    // 2026-11-08 exceeds 60 days
    await expect(
      useCase.execute({
        serviceId: activeService.id,
        date: "2026-11-08",
      }),
    ).rejects.toThrow(BookingHorizonExceededError);
  });

  it("throws ServiceNotFoundError for nonexistent service", async () => {
    const useCase = new GetAvailableSlotsUseCase(
      mockServiceRepo as ServiceRepository,
      mockBarberProfileRepo as BarberProfileRepository,
      mockBarberEligibilityRepo as BarberEligibilityRepository,
      mockScheduleRepo as ScheduleRepository,
      mockAppointmentRepo as AppointmentRepository,
      mockClock,
    );

    await expect(
      useCase.execute({
        serviceId: "nonexistent",
        date: validDate,
      }),
    ).rejects.toThrow(ServiceNotFoundError);
  });

  it("throws InactiveServiceError when service is inactive", async () => {
    mockServiceRepo.findById = async () => ({
      ...activeService,
      isActive: false,
    });

    const useCase = new GetAvailableSlotsUseCase(
      mockServiceRepo as ServiceRepository,
      mockBarberProfileRepo as BarberProfileRepository,
      mockBarberEligibilityRepo as BarberEligibilityRepository,
      mockScheduleRepo as ScheduleRepository,
      mockAppointmentRepo as AppointmentRepository,
      mockClock,
    );

    await expect(
      useCase.execute({
        serviceId: activeService.id,
        date: validDate,
      }),
    ).rejects.toThrow(InactiveServiceError);
  });

  it("throws BarberProfileNotFoundError when preferred barber is not found", async () => {
    const useCase = new GetAvailableSlotsUseCase(
      mockServiceRepo as ServiceRepository,
      mockBarberProfileRepo as BarberProfileRepository,
      mockBarberEligibilityRepo as BarberEligibilityRepository,
      mockScheduleRepo as ScheduleRepository,
      mockAppointmentRepo as AppointmentRepository,
      mockClock,
    );

    await expect(
      useCase.execute({
        serviceId: activeService.id,
        date: validDate,
        barberProfileId: "nonexistent-barber",
      }),
    ).rejects.toThrow(BarberProfileNotFoundError);
  });

  it("throws BarberNotEligibleError when preferred barber is not eligible for the service", async () => {
    mockBarberEligibilityRepo.isEligible = async () => false;

    const useCase = new GetAvailableSlotsUseCase(
      mockServiceRepo as ServiceRepository,
      mockBarberProfileRepo as BarberProfileRepository,
      mockBarberEligibilityRepo as BarberEligibilityRepository,
      mockScheduleRepo as ScheduleRepository,
      mockAppointmentRepo as AppointmentRepository,
      mockClock,
    );

    await expect(
      useCase.execute({
        serviceId: activeService.id,
        date: validDate,
        barberProfileId: "barber-1",
      }),
    ).rejects.toThrow(BarberNotEligibleError);
  });

  it("returns slots for specific preferred barber only", async () => {
    const useCase = new GetAvailableSlotsUseCase(
      mockServiceRepo as ServiceRepository,
      mockBarberProfileRepo as BarberProfileRepository,
      mockBarberEligibilityRepo as BarberEligibilityRepository,
      mockScheduleRepo as ScheduleRepository,
      mockAppointmentRepo as AppointmentRepository,
      mockClock,
    );

    // Barber 1 works 09:00 - 11:00 (30 min service -> 09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30)
    const result = await useCase.execute({
      serviceId: activeService.id,
      date: validDate,
      barberProfileId: "barber-1",
    });

    expect(result.date).toBe(validDate);
    expect(result.slots).toHaveLength(7);
    expect(result.slots[0].startsAt.toISOString()).toBe(
      new Date("2026-09-08T09:00:00.000+07:00").toISOString(),
    );
    expect(result.slots[6].startsAt.toISOString()).toBe(
      new Date("2026-09-08T10:30:00.000+07:00").toISOString(),
    );
  });

  it("in ANY_AVAILABLE mode aggregates and deduplicates slots across eligible barbers", async () => {
    const useCase = new GetAvailableSlotsUseCase(
      mockServiceRepo as ServiceRepository,
      mockBarberProfileRepo as BarberProfileRepository,
      mockBarberEligibilityRepo as BarberEligibilityRepository,
      mockScheduleRepo as ScheduleRepository,
      mockAppointmentRepo as AppointmentRepository,
      mockClock,
    );

    // Barber 1 works 09:00 - 11:00 (starts: 09:00 .. 10:30)
    // Barber 2 works 10:00 - 12:00 (starts: 10:00 .. 11:30)
    // Overlap: 10:00, 10:15, 10:30 exist for BOTH barbers.
    // Union should have starts:
    // 09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30, 10:45, 11:00, 11:15, 11:30
    // Total 11 unique slots.
    const result = await useCase.execute({
      serviceId: activeService.id,
      date: validDate,
    });

    expect(result.date).toBe(validDate);
    expect(result.slots).toHaveLength(11);
    expect(result.slots[0].startsAt.toISOString()).toBe(
      new Date("2026-09-08T09:00:00.000+07:00").toISOString(),
    );
    expect(result.slots[10].startsAt.toISOString()).toBe(
      new Date("2026-09-08T11:30:00.000+07:00").toISOString(),
    );

    // Result DTO contains ONLY date and slots[{startsAt, endsAt}]
    const sampleSlot = result.slots[0];
    expect(Object.keys(sampleSlot)).toEqual(["startsAt", "endsAt"]);
  });

  it("returns empty slots if shop is closed on the requested day", async () => {
    mockScheduleRepo.getBusinessHoursForDay = async () => ({
      ...shopBusinessHours,
      isClosed: true,
    });

    const useCase = new GetAvailableSlotsUseCase(
      mockServiceRepo as ServiceRepository,
      mockBarberProfileRepo as BarberProfileRepository,
      mockBarberEligibilityRepo as BarberEligibilityRepository,
      mockScheduleRepo as ScheduleRepository,
      mockAppointmentRepo as AppointmentRepository,
      mockClock,
    );

    const result = await useCase.execute({
      serviceId: activeService.id,
      date: validDate,
    });

    expect(result.slots).toEqual([]);
  });

  it("returns empty slots if no barbers are eligible for the service", async () => {
    mockBarberEligibilityRepo.findEligibleBarberProfileIds = async () => [];

    const useCase = new GetAvailableSlotsUseCase(
      mockServiceRepo as ServiceRepository,
      mockBarberProfileRepo as BarberProfileRepository,
      mockBarberEligibilityRepo as BarberEligibilityRepository,
      mockScheduleRepo as ScheduleRepository,
      mockAppointmentRepo as AppointmentRepository,
      mockClock,
    );

    const result = await useCase.execute({
      serviceId: activeService.id,
      date: validDate,
    });

    expect(result.slots).toEqual([]);
  });

  describe("Clock snapshot consistency", () => {
    it("calls clock.now() exactly once per execute()", async () => {
      let callCount = 0;
      const countingClock: Clock = {
        now: () => {
          callCount++;
          return fixedNow;
        },
      };

      const useCase = new GetAvailableSlotsUseCase(
        mockServiceRepo as ServiceRepository,
        mockBarberProfileRepo as BarberProfileRepository,
        mockBarberEligibilityRepo as BarberEligibilityRepository,
        mockScheduleRepo as ScheduleRepository,
        mockAppointmentRepo as AppointmentRepository,
        countingClock,
      );

      await useCase.execute({
        serviceId: activeService.id,
        date: validDate,
        barberProfileId: "barber-1",
      });

      expect(callCount).toBe(1);
    });

    it("calls clock.now() exactly once total in ANY_AVAILABLE mode with multiple barbers", async () => {
      let callCount = 0;
      const countingClock: Clock = {
        now: () => {
          callCount++;
          return fixedNow;
        },
      };

      const useCase = new GetAvailableSlotsUseCase(
        mockServiceRepo as ServiceRepository,
        mockBarberProfileRepo as BarberProfileRepository,
        mockBarberEligibilityRepo as BarberEligibilityRepository,
        mockScheduleRepo as ScheduleRepository,
        mockAppointmentRepo as AppointmentRepository,
        countingClock,
      );

      // In ANY_AVAILABLE mode, there are 2 eligible barbers (barber-1 and barber-2)
      const result = await useCase.execute({
        serviceId: activeService.id,
        date: validDate,
      });

      expect(callCount).toBe(1);
      expect(result.slots.length).toBeGreaterThan(0);
    });

    it("freezes time for the entire execution even if clock would advance on subsequent calls", async () => {
      let invocation = 0;
      const advancingClock: Clock = {
        now: () => {
          invocation++;
          if (invocation === 1) {
            // First call (snapshot taken at start): morning 08:00
            return new Date("2026-09-08T08:00:00.000+07:00");
          }
          // Subsequent call (if called, would simulate evening 18:00 past shift)
          return new Date("2026-09-08T18:00:00.000+07:00");
        },
      };

      const useCase = new GetAvailableSlotsUseCase(
        mockServiceRepo as ServiceRepository,
        mockBarberProfileRepo as BarberProfileRepository,
        mockBarberEligibilityRepo as BarberEligibilityRepository,
        mockScheduleRepo as ScheduleRepository,
        mockAppointmentRepo as AppointmentRepository,
        advancingClock,
      );

      const result = await useCase.execute({
        serviceId: activeService.id,
        date: validDate,
        barberProfileId: "barber-1",
      });

      expect(invocation).toBe(1);
      // Slots starting at 09:00 must still be present because execution was based on 08:00 snapshot
      expect(result.slots[0].startsAt.toISOString()).toBe(
        new Date("2026-09-08T09:00:00.000+07:00").toISOString(),
      );
    });
  });
});
