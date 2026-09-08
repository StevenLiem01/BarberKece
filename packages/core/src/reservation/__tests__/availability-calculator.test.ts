import { describe, it, expect } from "vitest";
import { AvailabilityCalculator } from "../domain/availability-calculator.js";
import { BusinessHours } from "../models/business-hours.js";
import { BarberSchedule } from "../models/barber-schedule.js";
import { ScheduleException } from "../models/schedule-exception.js";
import { Appointment } from "../models/appointment.js";
import { AppointmentStatus } from "../domain/appointment-status.js";

describe("AvailabilityCalculator", () => {
  const dateStr = "2026-09-08"; // Tuesday
  const defaultBusinessHours: BusinessHours = {
    id: "bh-1",
    dayOfWeek: 2,
    openTime: "09:00:00",
    closeTime: "21:00:00",
    isClosed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultSchedule: BarberSchedule = {
    id: "bs-1",
    barberProfileId: "barber-1",
    dayOfWeek: 2,
    startTime: "09:00:00",
    endTime: "17:00:00",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const pastNow = new Date("2026-09-08T00:00:00.000+07:00");

  it("returns empty array when shop has no business hours or is closed", () => {
    const slotsNoHours = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 30,
      businessHours: null,
      barberSchedules: [defaultSchedule],
      scheduleExceptions: [],
      activeAppointments: [],
      now: pastNow,
    });
    expect(slotsNoHours).toEqual([]);

    const slotsClosed = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 30,
      businessHours: { ...defaultBusinessHours, isClosed: true },
      barberSchedules: [defaultSchedule],
      scheduleExceptions: [],
      activeAppointments: [],
      now: pastNow,
    });
    expect(slotsClosed).toEqual([]);
  });

  it("returns empty array when service duration is <= 0", () => {
    const slots = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 0,
      businessHours: defaultBusinessHours,
      barberSchedules: [defaultSchedule],
      scheduleExceptions: [],
      activeAppointments: [],
      now: pastNow,
    });
    expect(slots).toEqual([]);
  });

  it("aligns off-grid shift start to next 15-minute boundary", () => {
    // Shift starts at 09:07
    const offGridSchedule: BarberSchedule = {
      ...defaultSchedule,
      startTime: "09:07:00",
      endTime: "10:00:00",
    };

    const slots = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 30,
      businessHours: defaultBusinessHours,
      barberSchedules: [offGridSchedule],
      scheduleExceptions: [],
      activeAppointments: [],
      now: pastNow,
    });

    // First candidate starts at 09:15:00 (+07:00), ending at 09:45:00
    // Next candidate starts at 09:30:00 (+07:00), ending at 10:00:00
    expect(slots).toHaveLength(2);
    expect(slots[0].startsAt.toISOString()).toBe(
      new Date("2026-09-08T09:15:00.000+07:00").toISOString(),
    );
    expect(slots[0].endsAt.toISOString()).toBe(
      new Date("2026-09-08T09:45:00.000+07:00").toISOString(),
    );
    expect(slots[1].startsAt.toISOString()).toBe(
      new Date("2026-09-08T09:30:00.000+07:00").toISOString(),
    );
    expect(slots[1].endsAt.toISOString()).toBe(
      new Date("2026-09-08T10:00:00.000+07:00").toISOString(),
    );
  });

  it("supports split shifts and ensures full service fits within one continuous window", () => {
    // Morning shift 09:00 - 12:00, Afternoon shift 13:00 - 17:00
    const morningShift: BarberSchedule = {
      ...defaultSchedule,
      id: "shift-1",
      startTime: "09:00:00",
      endTime: "12:00:00",
    };
    const afternoonShift: BarberSchedule = {
      ...defaultSchedule,
      id: "shift-2",
      startTime: "13:00:00",
      endTime: "17:00:00",
    };

    const slots60 = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 60,
      businessHours: defaultBusinessHours,
      barberSchedules: [morningShift, afternoonShift],
      scheduleExceptions: [],
      activeAppointments: [],
      now: pastNow,
    });

    // In morning shift (09:00-12:00):
    // 09:00-10:00, 09:15-10:15, 09:30-10:30, 09:45-10:45,
    // 10:00-11:00, 10:15-11:15, 10:30-11:30, 10:45-11:45,
    // 11:00-12:00
    // (Total 9 slots in morning. Candidate at 11:15 ends at 12:15, which exceeds 12:00, so omitted)
    const morningSlots = slots60.filter(
      (s) => s.endsAt <= new Date("2026-09-08T12:00:00.000+07:00"),
    );
    expect(morningSlots).toHaveLength(9);

    // No slot should span across lunch break (12:00 - 13:00)
    const spanningSlots = slots60.filter(
      (s) =>
        s.startsAt < new Date("2026-09-08T13:00:00.000+07:00") &&
        s.endsAt > new Date("2026-09-08T12:00:00.000+07:00"),
    );
    expect(spanningSlots).toHaveLength(0);
  });

  it("blocks slots overlapping schedule exceptions and active appointments", () => {
    // Schedule 09:00 - 12:00
    const schedule: BarberSchedule = {
      ...defaultSchedule,
      startTime: "09:00:00",
      endTime: "12:00:00",
    };

    // Exception: 10:00 - 11:00
    const exception: ScheduleException = {
      id: "ex-1",
      barberProfileId: "barber-1",
      reason: "Meeting",
      startsAt: new Date("2026-09-08T10:00:00.000+07:00"),
      endsAt: new Date("2026-09-08T11:00:00.000+07:00"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const slots = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 30,
      businessHours: defaultBusinessHours,
      barberSchedules: [schedule],
      scheduleExceptions: [exception],
      activeAppointments: [],
      now: pastNow,
    });

    // Slots should NOT overlap with 10:00 - 11:00
    for (const slot of slots) {
      const overlaps =
        slot.startsAt < exception.endsAt && slot.endsAt > exception.startsAt;
      expect(overlaps).toBe(false);
    }

    // Contiguous slots (ending at 10:00, or starting at 11:00) MUST be allowed!
    const slotEndingAt10 = slots.find(
      (s) => s.endsAt.getTime() === exception.startsAt.getTime(),
    );
    expect(slotEndingAt10).toBeDefined();

    const slotStartingAt11 = slots.find(
      (s) => s.startsAt.getTime() === exception.endsAt.getTime(),
    );
    expect(slotStartingAt11).toBeDefined();
  });

  it("allows contiguous appointments and blocks only overlapping intervals", () => {
    const schedule: BarberSchedule = {
      ...defaultSchedule,
      startTime: "09:00:00",
      endTime: "11:00:00",
    };

    const appointment: Appointment = {
      id: "appt-1",
      bookingReference: "BK-1234",
      customerId: "cust-1",
      barberProfileId: "barber-1",
      serviceId: "svc-1",
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date("2026-09-08T09:30:00.000+07:00"),
      endsAt: new Date("2026-09-08T10:00:00.000+07:00"),
      serviceDurationMinutes: 30,
      priceRupiah: 50000,
      notes: null,
      cancellationReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const slots = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 30,
      businessHours: defaultBusinessHours,
      barberSchedules: [schedule],
      scheduleExceptions: [],
      activeAppointments: [appointment],
      now: pastNow,
    });

    // Slot 09:00 - 09:30 is contiguous with appointment start -> ALLOWED
    const slotBefore = slots.find(
      (s) =>
        s.startsAt.getTime() ===
          new Date("2026-09-08T09:00:00.000+07:00").getTime() &&
        s.endsAt.getTime() ===
          new Date("2026-09-08T09:30:00.000+07:00").getTime(),
    );
    expect(slotBefore).toBeDefined();

    // Slot 10:00 - 10:30 is contiguous with appointment end -> ALLOWED
    const slotAfter = slots.find(
      (s) =>
        s.startsAt.getTime() ===
          new Date("2026-09-08T10:00:00.000+07:00").getTime() &&
        s.endsAt.getTime() ===
          new Date("2026-09-08T10:30:00.000+07:00").getTime(),
    );
    expect(slotAfter).toBeDefined();

    // Any slot overlapping 09:30 - 10:00 (e.g. 09:15-09:45 or 09:45-10:15) must be absent
    const overlapping = slots.find(
      (s) => s.startsAt < appointment.endsAt && s.endsAt > appointment.startsAt,
    );
    expect(overlapping).toBeUndefined();
  });

  it("filters out past slots when booking for today", () => {
    const schedule: BarberSchedule = {
      ...defaultSchedule,
      startTime: "09:00:00",
      endTime: "13:00:00",
    };

    // Current time is 10:18:00 WIB
    const nowMidday = new Date("2026-09-08T10:18:00.000+07:00");

    const slots = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 30,
      businessHours: defaultBusinessHours,
      barberSchedules: [schedule],
      scheduleExceptions: [],
      activeAppointments: [],
      now: nowMidday,
    });

    // Earliest start must be >= 10:30 (next quarter-hour after 10:18)
    for (const slot of slots) {
      expect(slot.startsAt.getTime()).toBeGreaterThanOrEqual(
        new Date("2026-09-08T10:30:00.000+07:00").getTime(),
      );
    }

    expect(slots[0].startsAt.toISOString()).toBe(
      new Date("2026-09-08T10:30:00.000+07:00").toISOString(),
    );
  });

  it("supports different durations: 30m, 60m, 75m, 120m", () => {
    const schedule: BarberSchedule = {
      ...defaultSchedule,
      startTime: "09:00:00",
      endTime: "11:00:00", // 2 hours window = 120 minutes
    };

    const slots30 = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 30,
      businessHours: defaultBusinessHours,
      barberSchedules: [schedule],
      scheduleExceptions: [],
      activeAppointments: [],
      now: pastNow,
    });
    // Starts: 09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30 (ends 11:00) -> 7 slots
    expect(slots30).toHaveLength(7);

    const slots60 = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 60,
      businessHours: defaultBusinessHours,
      barberSchedules: [schedule],
      scheduleExceptions: [],
      activeAppointments: [],
      now: pastNow,
    });
    // Starts: 09:00, 09:15, 09:30, 09:45, 10:00 (ends 11:00) -> 5 slots
    expect(slots60).toHaveLength(5);

    const slots75 = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 75,
      businessHours: defaultBusinessHours,
      barberSchedules: [schedule],
      scheduleExceptions: [],
      activeAppointments: [],
      now: pastNow,
    });
    // Starts: 09:00 (ends 10:15), 09:15 (ends 10:30), 09:30 (ends 10:45), 09:45 (ends 11:00) -> 4 slots
    expect(slots75).toHaveLength(4);

    const slots120 = AvailabilityCalculator.calculateBarberSlots({
      dateStr,
      serviceDurationMinutes: 120,
      businessHours: defaultBusinessHours,
      barberSchedules: [schedule],
      scheduleExceptions: [],
      activeAppointments: [],
      now: pastNow,
    });
    // Starts: 09:00 (ends 11:00) -> 1 slot
    expect(slots120).toHaveLength(1);
  });

  describe("startsAt > now strict boundary enforcement", () => {
    const shiftSchedule: BarberSchedule = {
      ...defaultSchedule,
      startTime: "09:00:00",
      endTime: "12:00:00",
    };

    it("allows candidate at 09:15 when now is 09:14:59.999", () => {
      const now = new Date("2026-09-08T09:14:59.999+07:00");
      const slots = AvailabilityCalculator.calculateBarberSlots({
        dateStr,
        serviceDurationMinutes: 30,
        businessHours: defaultBusinessHours,
        barberSchedules: [shiftSchedule],
        scheduleExceptions: [],
        activeAppointments: [],
        now,
      });

      expect(slots[0].startsAt.toISOString()).toBe(
        new Date("2026-09-08T09:15:00.000+07:00").toISOString(),
      );
    });

    it("strictly forbids candidate at 09:15 when now is 09:15:00.000 (startsAt <= now)", () => {
      const now = new Date("2026-09-08T09:15:00.000+07:00");
      const slots = AvailabilityCalculator.calculateBarberSlots({
        dateStr,
        serviceDurationMinutes: 30,
        businessHours: defaultBusinessHours,
        barberSchedules: [shiftSchedule],
        scheduleExceptions: [],
        activeAppointments: [],
        now,
      });

      // 09:15 MUST NOT be returned! First possible aligned slot is 09:30
      expect(slots[0].startsAt.toISOString()).toBe(
        new Date("2026-09-08T09:30:00.000+07:00").toISOString(),
      );
      // Verify no slot has startsAt <= now
      for (const slot of slots) {
        expect(slot.startsAt.getTime()).toBeGreaterThan(now.getTime());
      }
    });

    it("strictly advances to 09:30 when now is 09:15:00.001", () => {
      const now = new Date("2026-09-08T09:15:00.001+07:00");
      const slots = AvailabilityCalculator.calculateBarberSlots({
        dateStr,
        serviceDurationMinutes: 30,
        businessHours: defaultBusinessHours,
        barberSchedules: [shiftSchedule],
        scheduleExceptions: [],
        activeAppointments: [],
        now,
      });

      expect(slots[0].startsAt.toISOString()).toBe(
        new Date("2026-09-08T09:30:00.000+07:00").toISOString(),
      );
      for (const slot of slots) {
        expect(slot.startsAt.getTime()).toBeGreaterThan(now.getTime());
      }
    });

    it("emits 09:15 as first candidate for off-grid shift 09:07 when now is sufficiently early", () => {
      const offGridSchedule: BarberSchedule = {
        ...defaultSchedule,
        startTime: "09:07:00",
        endTime: "11:00:00",
      };
      const earlyNow = new Date("2026-09-08T08:00:00.000+07:00");
      const slots = AvailabilityCalculator.calculateBarberSlots({
        dateStr,
        serviceDurationMinutes: 30,
        businessHours: defaultBusinessHours,
        barberSchedules: [offGridSchedule],
        scheduleExceptions: [],
        activeAppointments: [],
        now: earlyNow,
      });

      expect(slots[0].startsAt.toISOString()).toBe(
        new Date("2026-09-08T09:15:00.000+07:00").toISOString(),
      );
    });
  });
});
