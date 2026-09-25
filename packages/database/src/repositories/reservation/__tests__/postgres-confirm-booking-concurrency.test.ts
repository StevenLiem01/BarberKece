import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { DatabaseClient } from "../../../client.js";
import { PostgresBookingTransactionRunner } from "../booking-transaction-runner.js";
import { appointments } from "../../../schema/reservation/appointments.js";
import { idempotencyRecords } from "../../../schema/reservation/idempotency_records.js";
import { services } from "../../../schema/reservation/services.js";
import { users } from "../../../schema/identity/users.js";
import { barberProfiles } from "../../../schema/barber/barber_profiles.js";
import { barberServices } from "../../../schema/reservation/barber_services.js";
import { businessHours } from "../../../schema/reservation/business_hours.js";
import { barberSchedules } from "../../../schema/reservation/barber_schedules.js";
import {
  ConfirmBookingUseCase,
  AppointmentStatus,
  SlotAlreadyBookedError,
  CustomerBookingConflictError,
  IdempotencyPayloadMismatchError,
} from "@barberkece/core/reservation";
import {
  createSafeTestDatabaseContext,
  type SafeTestDatabaseContext,
} from "../../../testing/index.js";

describe("PostgreSQL Confirm Booking Concurrency & Invariants", () => {
  let safeDb: SafeTestDatabaseContext | undefined;
  let dbClient: DatabaseClient;
  let runner: PostgresBookingTransactionRunner;

  // Track created entities for cleanup
  const cleanupUsers: string[] = [];
  const cleanupBarbers: string[] = [];
  const cleanupServices: string[] = [];
  const cleanupAppointments: string[] = [];
  const cleanupIdempotencyRecords: string[] = [];

  let testServiceId: string;
  let testCustomer1Id: string;
  let testCustomer2Id: string;
  let testBarber1Id: string;
  let testBarber2Id: string;

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
      name: "Concurrency Test Cut",
      description: "Service for testing concurrency",
      durationMinutes: 45,
      priceRupiah: 60000,
      isActive: true,
    });

    // Setup Customers
    testCustomer1Id = uuidv7();
    cleanupUsers.push(testCustomer1Id);
    await dbClient.db.insert(users).values({
      id: testCustomer1Id,
      email: `test-cust1-${testCustomer1Id.slice(0, 8)}@barberkece.test`,
      passwordHash: "dummyhash",
      role: "CUSTOMER",
      status: "ACTIVE",
    });

    testCustomer2Id = uuidv7();
    cleanupUsers.push(testCustomer2Id);
    await dbClient.db.insert(users).values({
      id: testCustomer2Id,
      email: `test-cust2-${testCustomer2Id.slice(0, 8)}@barberkece.test`,
      passwordHash: "dummyhash",
      role: "CUSTOMER",
      status: "ACTIVE",
    });

    // Setup Barber 1
    const barber1UserId = uuidv7();
    cleanupUsers.push(barber1UserId);
    await dbClient.db.insert(users).values({
      id: barber1UserId,
      email: `test-barber1-${barber1UserId.slice(0, 8)}@barberkece.test`,
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
      endTime: "19:00:00",
      isActive: true,
    });

    // Setup Barber 2
    const barber2UserId = uuidv7();
    cleanupUsers.push(barber2UserId);
    await dbClient.db.insert(users).values({
      id: barber2UserId,
      email: `test-barber2-${barber2UserId.slice(0, 8)}@barberkece.test`,
      passwordHash: "dummyhash",
      role: "BARBER",
      status: "ACTIVE",
      displayName: "Barber Two",
    });

    testBarber2Id = uuidv7();
    cleanupBarbers.push(testBarber2Id);
    await dbClient.db.insert(barberProfiles).values({
      id: testBarber2Id,
      userId: barber2UserId,
    });

    await dbClient.db.insert(barberServices).values({
      barberProfileId: testBarber2Id,
      serviceId: testServiceId,
    });

    await dbClient.db.insert(barberSchedules).values({
      id: uuidv7(),
      barberProfileId: testBarber2Id,
      dayOfWeek: 3,
      startTime: "09:00:00",
      endTime: "19:00:00",
      isActive: true,
    });
  });

  afterAll(async () => {
    if (safeDb?.isVerified) {
      await safeDb.safeCleanup(async () => {
        if (cleanupAppointments.length > 0) {
          await dbClient.db
            .delete(idempotencyRecords)
            .where(
              inArray(idempotencyRecords.appointmentId, cleanupAppointments),
            );
          await dbClient.db
            .delete(appointments)
            .where(inArray(appointments.id, cleanupAppointments));
        }
        if (cleanupIdempotencyRecords.length > 0) {
          await dbClient.db
            .delete(idempotencyRecords)
            .where(inArray(idempotencyRecords.id, cleanupIdempotencyRecords));
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
          await dbClient.db
            .delete(users)
            .where(inArray(users.id, cleanupUsers));
        }
      });
      await safeDb.close();
    }
  });

  it("1. Concurrent same idempotency key + same payload: exactly one appointment exists and both callers resolve to same result", async () => {
    const useCase = new ConfirmBookingUseCase(runner, testClock);
    // 10:00 Jakarta (03:00 UTC)
    const startsAt = new Date("2026-09-09T03:00:00.000Z");
    const idempotencyKey = `idem-${uuidv7()}`;

    const [res1, res2] = await Promise.all([
      useCase.execute({
        actorId: testCustomer1Id,
        customerId: testCustomer1Id,
        serviceId: testServiceId,
        startsAt,
        barberProfileId: testBarber1Id,
        notes: "Identical concurrent payload",
        idempotencyKey,
      }),
      useCase.execute({
        actorId: testCustomer1Id,
        customerId: testCustomer1Id,
        serviceId: testServiceId,
        startsAt,
        barberProfileId: testBarber1Id,
        notes: "Identical concurrent payload",
        idempotencyKey,
      }),
    ]);

    // Both point to the exact same appointment
    expect(res1.appointment.id).toBe(res2.appointment.id);
    cleanupAppointments.push(res1.appointment.id);

    // Exactly one is regular creation and the other is idempotent replay
    const replays = [res1.isIdempotentReplay, res2.isIdempotentReplay];
    expect(replays).toContain(false);
    expect(replays).toContain(true);

    // Verify DB count
    const rows = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, res1.appointment.id));
    expect(rows.length).toBe(1);

    const idemRows = await dbClient.db
      .select()
      .from(idempotencyRecords)
      .where(eq(idempotencyRecords.idempotencyKey, idempotencyKey));
    expect(idemRows.length).toBe(1);
    cleanupIdempotencyRecords.push(idemRows[0]!.id);
  });

  it("2. Concurrent same idempotency key + different payload: one succeeds and other receives IdempotencyPayloadMismatchError", async () => {
    const useCase = new ConfirmBookingUseCase(runner, testClock);
    // 11:00 Jakarta (04:00 UTC)
    const startsAt = new Date("2026-09-09T04:00:00.000Z");
    const idempotencyKey = `idem-${uuidv7()}`;

    const p1 = useCase.execute({
      actorId: testCustomer1Id,
      customerId: testCustomer1Id,
      serviceId: testServiceId,
      startsAt,
      barberProfileId: testBarber1Id,
      notes: "Payload variation A",
      idempotencyKey,
    });

    const p2 = useCase.execute({
      actorId: testCustomer1Id,
      customerId: testCustomer1Id,
      serviceId: testServiceId,
      startsAt,
      barberProfileId: testBarber1Id,
      notes: "Payload variation B", // Different payload
      idempotencyKey,
    });

    const results = await Promise.allSettled([p1, p2]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const successfulAppointment = (
      fulfilled[0] as PromiseFulfilledResult<{
        appointment: { id: string };
      }>
    ).value.appointment;
    cleanupAppointments.push(successfulAppointment.id);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(IdempotencyPayloadMismatchError);

    // Only 1 record in DB
    const idemRows = await dbClient.db
      .select()
      .from(idempotencyRecords)
      .where(eq(idempotencyRecords.idempotencyKey, idempotencyKey));
    expect(idemRows.length).toBe(1);
    cleanupIdempotencyRecords.push(idemRows[0]!.id);
  });

  it("3. Concurrent specific barber same slot: exactly one succeeds and other gets SlotAlreadyBookedError", async () => {
    const useCase = new ConfirmBookingUseCase(runner, testClock);
    // 12:00 Jakarta (05:00 UTC)
    const startsAt = new Date("2026-09-09T05:00:00.000Z");

    const p1 = useCase.execute({
      actorId: testCustomer1Id,
      customerId: testCustomer1Id,
      serviceId: testServiceId,
      startsAt,
      barberProfileId: testBarber1Id,
      idempotencyKey: `idem-cust1-${uuidv7()}`,
    });

    const p2 = useCase.execute({
      actorId: testCustomer2Id,
      customerId: testCustomer2Id,
      serviceId: testServiceId,
      startsAt,
      barberProfileId: testBarber1Id,
      idempotencyKey: `idem-cust2-${uuidv7()}`,
    });

    const results = await Promise.allSettled([p1, p2]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const successfulAppt = (
      fulfilled[0] as PromiseFulfilledResult<{
        appointment: { id: string };
      }>
    ).value.appointment;
    cleanupAppointments.push(successfulAppt.id);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(SlotAlreadyBookedError);
  });

  it("4. Concurrent same customer overlap: exactly one succeeds and other gets CustomerBookingConflictError", async () => {
    const useCase = new ConfirmBookingUseCase(runner, testClock);
    // 13:00 Jakarta (06:00 UTC)
    const startsAt = new Date("2026-09-09T06:00:00.000Z");

    // Same customer 1 trying to book barber 1 and barber 2 for overlapping slot
    const p1 = useCase.execute({
      actorId: testCustomer1Id,
      customerId: testCustomer1Id,
      serviceId: testServiceId,
      startsAt,
      barberProfileId: testBarber1Id,
      idempotencyKey: `idem-cust-a-${uuidv7()}`,
    });

    const p2 = useCase.execute({
      actorId: testCustomer1Id,
      customerId: testCustomer1Id,
      serviceId: testServiceId,
      startsAt,
      barberProfileId: testBarber2Id,
      idempotencyKey: `idem-cust-b-${uuidv7()}`,
    });

    const results = await Promise.allSettled([p1, p2]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const successfulAppt = (
      fulfilled[0] as PromiseFulfilledResult<{
        appointment: { id: string };
      }>
    ).value.appointment;
    cleanupAppointments.push(successfulAppt.id);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(CustomerBookingConflictError);
  });

  it("5. ANY_AVAILABLE race with 2 barbers: both concurrent requests serialize and assign separate barbers", async () => {
    const useCase = new ConfirmBookingUseCase(runner, testClock);
    // 14:00 Jakarta (07:00 UTC)
    const startsAt = new Date("2026-09-09T07:00:00.000Z");

    const [res1, res2] = await Promise.all([
      useCase.execute({
        actorId: testCustomer1Id,
        customerId: testCustomer1Id,
        serviceId: testServiceId,
        startsAt,
        barberProfileId: null, // ANY_AVAILABLE
        idempotencyKey: `any-avail-1-${uuidv7()}`,
      }),
      useCase.execute({
        actorId: testCustomer2Id,
        customerId: testCustomer2Id,
        serviceId: testServiceId,
        startsAt,
        barberProfileId: null, // ANY_AVAILABLE
        idempotencyKey: `any-avail-2-${uuidv7()}`,
      }),
    ]);

    expect(res1.appointment.id).not.toBe(res2.appointment.id);
    cleanupAppointments.push(res1.appointment.id, res2.appointment.id);

    // They must have been assigned DIFFERENT barbers
    expect(res1.appointment.barberProfileId).not.toBe(
      res2.appointment.barberProfileId,
    );
    const assignedBarbers = new Set([
      res1.appointment.barberProfileId,
      res2.appointment.barberProfileId,
    ]);
    expect(assignedBarbers.has(testBarber1Id)).toBe(true);
    expect(assignedBarbers.has(testBarber2Id)).toBe(true);

    expect(res1.appointment.isAutoAssigned).toBe(true);
    expect(res2.appointment.isAutoAssigned).toBe(true);
  });

  it("6. ANY_AVAILABLE race with 1 barber: exactly one succeeds and the other gets SlotAlreadyBookedError", async () => {
    // We create a temporary service eligible ONLY for Barber 1
    const singleBarberServiceId = uuidv7();
    cleanupServices.push(singleBarberServiceId);
    await dbClient.db.insert(services).values({
      id: singleBarberServiceId,
      name: "Single Barber Cut",
      description: "Only barber 1 can do this",
      durationMinutes: 45,
      priceRupiah: 80000,
      isActive: true,
    });
    await dbClient.db.insert(barberServices).values({
      barberProfileId: testBarber1Id,
      serviceId: singleBarberServiceId,
    });

    const useCase = new ConfirmBookingUseCase(runner, testClock);
    // 15:00 Jakarta (08:00 UTC)
    const startsAt = new Date("2026-09-09T08:00:00.000Z");

    const p1 = useCase.execute({
      actorId: testCustomer1Id,
      customerId: testCustomer1Id,
      serviceId: singleBarberServiceId,
      startsAt,
      barberProfileId: null,
      idempotencyKey: `single-avail-1-${uuidv7()}`,
    });

    const p2 = useCase.execute({
      actorId: testCustomer2Id,
      customerId: testCustomer2Id,
      serviceId: singleBarberServiceId,
      startsAt,
      barberProfileId: null,
      idempotencyKey: `single-avail-2-${uuidv7()}`,
    });

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const appt = (
      fulfilled[0] as PromiseFulfilledResult<{
        appointment: { id: string };
      }>
    ).value.appointment;
    cleanupAppointments.push(appt.id);

    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error).toBeInstanceOf(SlotAlreadyBookedError);
  });

  it("7. Complete transaction rollback: no orphan appointment or idempotency record when error occurs", async () => {
    const customKey = `rollback-test-${uuidv7()}`;
    // 16:00 Jakarta (09:00 UTC)
    const startsAt = new Date("2026-09-09T09:00:00.000Z");

    await expect(
      runner.run(async (context) => {
        // Step 1: Insert an appointment
        const appt =
          await context.appointmentRepository.createConfirmedAppointmentWithRetry(
            {
              customerId: testCustomer1Id,
              barberProfileId: testBarber1Id,
              serviceId: testServiceId,
              startsAt,
              endsAt: new Date(startsAt.getTime() + 45 * 60 * 1000),
              serviceDurationMinutes: 45,
              priceRupiah: 60000,
              isAutoAssigned: false,
            },
            () => `BK-ROLLBACK-${uuidv7().slice(0, 6)}`,
          );

        // Step 2: Insert idempotency record
        await context.idempotencyRepository.createRecord({
          actorId: testCustomer1Id,
          operation: "CONFIRM_BOOKING",
          idempotencyKey: customKey,
          requestHash: "some-hash",
          appointmentId: appt.id,
        });

        // Step 3: Force transaction rollback
        throw new Error("Simulated intentional transaction failure");
      }),
    ).rejects.toThrow("Simulated intentional transaction failure");

    // Verify neither row was persisted
    const apptRows = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.customerId, testCustomer1Id));
    const orphanAppt = apptRows.find(
      (a) => a.startsAt.getTime() === startsAt.getTime(),
    );
    expect(orphanAppt).toBeUndefined();

    const idemRows = await dbClient.db
      .select()
      .from(idempotencyRecords)
      .where(eq(idempotencyRecords.idempotencyKey, customKey));
    expect(idemRows.length).toBe(0);
  });

  it("8 & 9. Booking-reference collision + PostgreSQL-safe SAVEPOINT retry: safely recovers and creates exactly 1 appointment without outer transaction abort", async () => {
    const existingRef = `BK-COLLIDE-${uuidv7()}`;
    const finalRef = `BK-RESOLVED-${uuidv7()}`;

    // 17:00 Jakarta (10:00 UTC)
    const existingStartsAt = new Date("2026-09-09T10:00:00.000Z");
    // Insert an existing appointment holding existingRef
    const [existingAppt] = await dbClient.db
      .insert(appointments)
      .values({
        id: uuidv7(),
        bookingReference: existingRef,
        customerId: testCustomer1Id,
        barberProfileId: testBarber1Id,
        serviceId: testServiceId,
        startsAt: existingStartsAt,
        endsAt: new Date(existingStartsAt.getTime() + 45 * 60 * 1000),
        serviceDurationMinutes: 45,
        priceRupiah: 60000,
        status: AppointmentStatus.CONFIRMED,
      })
      .returning();
    cleanupAppointments.push(existingAppt!.id);

    // Now test createConfirmedAppointmentWithRetry inside transaction:
    // 18:00 Jakarta (11:00 UTC)
    const newStartsAt = new Date("2026-09-09T11:00:00.000Z");

    let attemptCount = 0;
    const retryableGenerator = () => {
      attemptCount++;
      if (attemptCount === 1) {
        // First attempt collides!
        return existingRef;
      }
      // Second attempt generates fresh reference
      return finalRef;
    };

    const newAppt = await runner.run(async (context) => {
      return await context.appointmentRepository.createConfirmedAppointmentWithRetry(
        {
          customerId: testCustomer2Id,
          barberProfileId: testBarber2Id,
          serviceId: testServiceId,
          startsAt: newStartsAt,
          endsAt: new Date(newStartsAt.getTime() + 45 * 60 * 1000),
          serviceDurationMinutes: 45,
          priceRupiah: 60000,
          status: AppointmentStatus.CONFIRMED,
        },
        retryableGenerator,
        3,
      );
    });

    cleanupAppointments.push(newAppt.id);
    expect(attemptCount).toBe(2);
    expect(newAppt.bookingReference).toBe(finalRef);

    // Verify DB state: exactly one new appointment created
    const rows = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.bookingReference, finalRef));
    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe(newAppt.id);
  });

  it("10. Migration / Schema constraints: confirms idempotency_records unique and appointments.is_auto_assigned default", async () => {
    // Verify appointments.is_auto_assigned exists and defaults to false
    const [testAppt] = await dbClient.db
      .insert(appointments)
      .values({
        id: uuidv7(),
        bookingReference: `BK-DEFAULT-${uuidv7()}`,
        customerId: testCustomer1Id,
        barberProfileId: testBarber2Id,
        serviceId: testServiceId,
        startsAt: new Date("2026-09-09T12:00:00.000Z"),
        endsAt: new Date("2026-09-09T12:45:00.000Z"),
        serviceDurationMinutes: 45,
        priceRupiah: 60000,
      })
      .returning();
    cleanupAppointments.push(testAppt!.id);

    expect(testAppt!.isAutoAssigned).toBe(false);

    // Verify idempotency UNIQUE constraint
    const key = `unique-test-${uuidv7()}`;
    const [record1] = await dbClient.db
      .insert(idempotencyRecords)
      .values({
        id: uuidv7(),
        actorId: testCustomer1Id,
        operation: "TEST_OP",
        idempotencyKey: key,
        requestHash: "hash-1",
        appointmentId: testAppt!.id,
      })
      .returning();
    cleanupIdempotencyRecords.push(record1!.id);

    // Inserting identical (actorId, operation, idempotencyKey) MUST fail with 23505 unique constraint violation
    await expect(
      dbClient.db.insert(idempotencyRecords).values({
        id: uuidv7(),
        actorId: testCustomer1Id,
        operation: "TEST_OP",
        idempotencyKey: key,
        requestHash: "hash-2",
        appointmentId: testAppt!.id,
      }),
    ).rejects.toThrow();
  });
});
