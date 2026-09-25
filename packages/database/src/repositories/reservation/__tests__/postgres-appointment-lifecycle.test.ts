import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { DatabaseClient } from "../../../client.js";
import { PostgresBookingTransactionRunner } from "../booking-transaction-runner.js";
import { appointments } from "../../../schema/reservation/appointments.js";
import { services } from "../../../schema/reservation/services.js";
import { users } from "../../../schema/identity/users.js";
import { barberProfiles } from "../../../schema/barber/barber_profiles.js";
import { barberServices } from "../../../schema/reservation/barber_services.js";
import { businessHours } from "../../../schema/reservation/business_hours.js";
import { barberSchedules } from "../../../schema/reservation/barber_schedules.js";
import {
  CancelAppointmentUseCase,
  RescheduleAppointmentUseCase,
  ConfirmBookingUseCase,
  AppointmentStatus,
  SlotAlreadyBookedError,
} from "@barberkece/core/reservation";
import {
  createSafeTestDatabaseContext,
  type SafeTestDatabaseContext,
} from "../../../testing/index.js";

describe("PostgreSQL Appointment Lifecycle & Concurrency (Cancel & Reschedule)", () => {
  let safeDb: SafeTestDatabaseContext | undefined;
  let dbClient: DatabaseClient;
  let runner: PostgresBookingTransactionRunner;

  // Track created entities for cleanup
  const cleanupUsers: string[] = [];
  const cleanupBarbers: string[] = [];
  const cleanupServices: string[] = [];
  const cleanupAppointments: string[] = [];

  let testServiceId: string;
  let testCustomer1Id: string;
  let testCustomer2Id: string;
  let testBarber1Id: string;

  // Reference now: Wednesday 2026-09-09 08:00:00 Jakarta (01:00:00 UTC)
  const FIXED_NOW = new Date("2026-09-09T01:00:00.000Z");
  const testClock = { now: () => FIXED_NOW };

  beforeAll(async () => {
    safeDb = await createSafeTestDatabaseContext();
    dbClient = safeDb.dbClient;
    runner = new PostgresBookingTransactionRunner(dbClient.db);

    // Setup Wednesday business hours (day 3: 09:00 - 21:00)
    await dbClient.db
      .insert(businessHours)
      .values({
        id: uuidv7(),
        dayOfWeek: 3,
        openTime: "09:00:00",
        closeTime: "21:00:00",
        isClosed: false,
      })
      .onConflictDoUpdate({
        target: businessHours.dayOfWeek,
        set: {
          openTime: "09:00:00",
          closeTime: "21:00:00",
          isClosed: false,
        },
      });

    // Setup Test Service (duration 45 min)
    testServiceId = uuidv7();
    cleanupServices.push(testServiceId);
    await dbClient.db.insert(services).values({
      id: testServiceId,
      name: "Lifecycle Test Cut",
      description: "Service for testing lifecycle mutations",
      durationMinutes: 45,
      priceRupiah: 65000,
      isActive: true,
    });

    // Setup Customers
    testCustomer1Id = uuidv7();
    cleanupUsers.push(testCustomer1Id);
    await dbClient.db.insert(users).values({
      id: testCustomer1Id,
      email: `test-life-cust1-${testCustomer1Id.slice(0, 8)}@barberkece.test`,
      passwordHash: "dummyhash",
      role: "CUSTOMER",
      status: "ACTIVE",
    });

    testCustomer2Id = uuidv7();
    cleanupUsers.push(testCustomer2Id);
    await dbClient.db.insert(users).values({
      id: testCustomer2Id,
      email: `test-life-cust2-${testCustomer2Id.slice(0, 8)}@barberkece.test`,
      passwordHash: "dummyhash",
      role: "CUSTOMER",
      status: "ACTIVE",
    });

    // Setup Barber 1
    const barber1UserId = uuidv7();
    cleanupUsers.push(barber1UserId);
    await dbClient.db.insert(users).values({
      id: barber1UserId,
      email: `test-life-barber1-${barber1UserId.slice(0, 8)}@barberkece.test`,
      passwordHash: "dummyhash",
      role: "BARBER",
      status: "ACTIVE",
      displayName: "Barber One",
    });

    testBarber1Id = uuidv7();
    cleanupBarbers.push(testBarber1Id);
    await dbClient.db.insert(barberProfiles).values({
      id: testBarber1Id,
      userId: barber1UserId,
    });

    await dbClient.db.insert(barberServices).values({
      barberProfileId: testBarber1Id,
      serviceId: testServiceId,
    });

    await dbClient.db.insert(barberSchedules).values({
      id: uuidv7(),
      barberProfileId: testBarber1Id,
      dayOfWeek: 3,
      startTime: "09:00:00",
      endTime: "20:00:00",
      isActive: true,
    });
  });

  afterAll(async () => {
    if (safeDb?.isVerified) {
      await safeDb.safeCleanup(async () => {
        if (cleanupAppointments.length > 0) {
          await dbClient.db
            .delete(appointments)
            .where(inArray(appointments.id, cleanupAppointments));
        }
        if (cleanupBarbers.length > 0) {
          await dbClient.db
            .delete(barberServices)
            .where(inArray(barberServices.barberProfileId, cleanupBarbers));
          await dbClient.db
            .delete(barberSchedules)
            .where(inArray(barberSchedules.barberProfileId, cleanupBarbers));
          await dbClient.db
            .delete(barberProfiles)
            .where(inArray(barberProfiles.id, cleanupBarbers));
        }
        if (cleanupServices.length > 0) {
          await dbClient.db
            .delete(services)
            .where(inArray(services.id, cleanupServices));
        }
        if (cleanupUsers.length > 0) {
          await dbClient.db.delete(users).where(inArray(users.id, cleanupUsers));
        }
      });
      await safeDb.close();
    }
  });

  it("1. Cancellation updates status, records reason, and immediately releases slot for rebooking", async () => {
    const confirmUseCase = new ConfirmBookingUseCase(runner, testClock);
    const cancelUseCase = new CancelAppointmentUseCase(runner, testClock);

    // Book 10:00 Jakarta (03:00 UTC)
    const slotTime = new Date("2026-09-09T03:00:00.000Z");
    const confirmRes = await confirmUseCase.execute({
      actorId: testCustomer1Id,
      customerId: testCustomer1Id,
      serviceId: testServiceId,
      startsAt: slotTime,
      barberProfileId: testBarber1Id,
    });
    const apptId = confirmRes.appointment.id;
    cleanupAppointments.push(apptId);

    // Cancel appointment
    const cancelRes = await cancelUseCase.execute({
      actorId: testCustomer1Id,
      appointmentId: apptId,
      cancellationReason: "Cannot make it today",
    });

    expect(cancelRes.appointment.status).toBe(
      AppointmentStatus.CANCELLED_BY_CUSTOMER,
    );
    expect(cancelRes.appointment.cancellationReason).toBe(
      "Cannot make it today",
    );

    // Verify in DB directly
    const [dbRow] = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, apptId));
    expect(dbRow!.status).toBe(AppointmentStatus.CANCELLED_BY_CUSTOMER);
    expect(dbRow!.cancellationReason).toBe("Cannot make it today");

    // Now test slot release: Customer 2 books the exact same slot without conflict!
    const rebookRes = await confirmUseCase.execute({
      actorId: testCustomer2Id,
      customerId: testCustomer2Id,
      serviceId: testServiceId,
      startsAt: slotTime,
      barberProfileId: testBarber1Id,
    });
    expect(rebookRes.appointment.id).toBeDefined();
    cleanupAppointments.push(rebookRes.appointment.id);
  });

  it("2. Atomic reschedule updates DB row and preserves all snapshot fields and reference", async () => {
    const confirmUseCase = new ConfirmBookingUseCase(runner, testClock);
    const rescheduleUseCase = new RescheduleAppointmentUseCase(
      runner,
      testClock,
    );

    // Original booking at 11:00 Jakarta (04:00 UTC)
    const originalStartsAt = new Date("2026-09-09T04:00:00.000Z");
    const confirmRes = await confirmUseCase.execute({
      actorId: testCustomer1Id,
      customerId: testCustomer1Id,
      serviceId: testServiceId,
      startsAt: originalStartsAt,
      barberProfileId: testBarber1Id,
      notes: "Please be gentle",
    });
    const apptId = confirmRes.appointment.id;
    const originalRef = confirmRes.appointment.bookingReference;
    cleanupAppointments.push(apptId);

    // Reschedule to 14:00 Jakarta (07:00 UTC)
    const newStartsAt = new Date("2026-09-09T07:00:00.000Z");
    const rescheduleRes = await rescheduleUseCase.execute({
      actorId: testCustomer1Id,
      appointmentId: apptId,
      newStartsAt,
    });

    expect(rescheduleRes.appointment.startsAt).toEqual(newStartsAt);
    expect(rescheduleRes.appointment.endsAt).toEqual(
      new Date("2026-09-09T07:45:00.000Z"),
    );
    expect(rescheduleRes.appointment.id).toBe(apptId);
    expect(rescheduleRes.appointment.bookingReference).toBe(originalRef);
    expect(rescheduleRes.appointment.serviceDurationMinutes).toBe(45);
    expect(rescheduleRes.appointment.priceRupiah).toBe(65000);
    expect(rescheduleRes.appointment.barberProfileId).toBe(testBarber1Id);
    expect(rescheduleRes.appointment.isAutoAssigned).toBe(false);
    expect(rescheduleRes.appointment.notes).toBe("Please be gentle");

    // Verify DB state
    const [dbRow] = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, apptId));
    expect(dbRow!.startsAt).toEqual(newStartsAt);
    expect(dbRow!.bookingReference).toBe(originalRef);

    // Verify original slot (11:00) is now free for Customer 2 to book
    const customer2Res = await confirmUseCase.execute({
      actorId: testCustomer2Id,
      customerId: testCustomer2Id,
      serviceId: testServiceId,
      startsAt: originalStartsAt,
      barberProfileId: testBarber1Id,
    });
    expect(customer2Res.appointment.id).toBeDefined();
    cleanupAppointments.push(customer2Res.appointment.id);
  });

  it("3. Self-overlap shift succeeds in PostgreSQL without GiST self-exclusion conflict", async () => {
    const confirmUseCase = new ConfirmBookingUseCase(runner, testClock);
    const rescheduleUseCase = new RescheduleAppointmentUseCase(
      runner,
      testClock,
    );

    // Book 16:00 Jakarta (09:00 UTC)
    const originalStartsAt = new Date("2026-09-09T09:00:00.000Z");
    const confirmRes = await confirmUseCase.execute({
      actorId: testCustomer1Id,
      customerId: testCustomer1Id,
      serviceId: testServiceId,
      startsAt: originalStartsAt,
      barberProfileId: testBarber1Id,
    });
    const apptId = confirmRes.appointment.id;
    cleanupAppointments.push(apptId);

    // Shift by 15 minutes: 16:15 Jakarta (09:15 UTC) -> overlaps with 16:00-16:45!
    const newStartsAt = new Date("2026-09-09T09:15:00.000Z");
    const rescheduleRes = await rescheduleUseCase.execute({
      actorId: testCustomer1Id,
      appointmentId: apptId,
      newStartsAt,
    });

    expect(rescheduleRes.appointment.startsAt).toEqual(newStartsAt);
    expect(rescheduleRes.appointment.endsAt).toEqual(
      new Date("2026-09-09T10:00:00.000Z"),
    );
  });

  it("4. Target-slot conflict rolls back transaction and preserves original booking", async () => {
    const confirmUseCase = new ConfirmBookingUseCase(runner, testClock);
    const rescheduleUseCase = new RescheduleAppointmentUseCase(
      runner,
      testClock,
    );

    // Slot A: 17:00 Jakarta (10:00 UTC) booked by Customer 1
    const slotA = new Date("2026-09-09T10:00:00.000Z");
    const apptA = await confirmUseCase.execute({
      actorId: testCustomer1Id,
      customerId: testCustomer1Id,
      serviceId: testServiceId,
      startsAt: slotA,
      barberProfileId: testBarber1Id,
    });
    cleanupAppointments.push(apptA.appointment.id);

    // Slot B: 18:00 Jakarta (11:00 UTC) booked by Customer 2
    const slotB = new Date("2026-09-09T11:00:00.000Z");
    const apptB = await confirmUseCase.execute({
      actorId: testCustomer2Id,
      customerId: testCustomer2Id,
      serviceId: testServiceId,
      startsAt: slotB,
      barberProfileId: testBarber1Id,
    });
    cleanupAppointments.push(apptB.appointment.id);

    // Customer 1 tries to reschedule into Slot B (already occupied by Customer 2)
    await expect(
      rescheduleUseCase.execute({
        actorId: testCustomer1Id,
        appointmentId: apptA.appointment.id,
        newStartsAt: slotB,
      }),
    ).rejects.toThrow(SlotAlreadyBookedError);

    // Verify Appt A is STILL in Slot A (17:00)
    const [dbApptA] = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, apptA.appointment.id));
    expect(dbApptA!.startsAt).toEqual(slotA);
    expect(dbApptA!.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it("5. Concurrent reschedules of the same appointment serialize cleanly via row lock", async () => {
    const confirmUseCase = new ConfirmBookingUseCase(runner, testClock);
    const rescheduleUseCase = new RescheduleAppointmentUseCase(
      runner,
      testClock,
    );

    // Book 12:00 Jakarta (05:00 UTC)
    const initialStartsAt = new Date("2026-09-09T05:00:00.000Z");
    const confirmRes = await confirmUseCase.execute({
      actorId: testCustomer1Id,
      customerId: testCustomer1Id,
      serviceId: testServiceId,
      startsAt: initialStartsAt,
      barberProfileId: testBarber1Id,
    });
    const apptId = confirmRes.appointment.id;
    cleanupAppointments.push(apptId);

    // Two concurrent reschedules: one to 13:00 Jakarta (06:00 UTC), one to 15:00 Jakarta (08:00 UTC)
    const target1 = new Date("2026-09-09T06:00:00.000Z");
    const target2 = new Date("2026-09-09T08:00:00.000Z");

    const p1 = rescheduleUseCase.execute({
      actorId: testCustomer1Id,
      appointmentId: apptId,
      newStartsAt: target1,
    });

    const p2 = rescheduleUseCase.execute({
      actorId: testCustomer1Id,
      appointmentId: apptId,
      newStartsAt: target2,
    });

    // Both should settle without deadlock or unhandled DB crash
    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    // Inspect final state in DB
    const [finalDbRow] = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, apptId));
    expect([target1.toISOString(), target2.toISOString()]).toContain(
      finalDbRow!.startsAt.toISOString(),
    );
  });
});
