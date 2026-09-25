import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { DatabaseClient } from "../../../client.js";
import { PostgresBookingTransactionRunner } from "../booking-transaction-runner.js";
import { appointments } from "../../../schema/reservation/appointments.js";
import { services } from "../../../schema/reservation/services.js";
import { users } from "../../../schema/identity/users.js";
import { barberProfiles } from "../../../schema/barber/barber_profiles.js";
import {
  TransitionAppointmentStatusUseCase,
  AppointmentStatus,
  AppointmentOwnershipError,
  CancellationReasonRequiredError,
  NoShowGracePeriodNotElapsedError,
  InvalidAppointmentStatusTransitionError,
} from "@barberkece/core/reservation";
import {
  createSafeTestDatabaseContext,
  type SafeTestDatabaseContext,
} from "../../../testing/index.js";

describe("PostgreSQL Barber Appointment Status Transition & Concurrency", () => {
  let safeDb: SafeTestDatabaseContext | undefined;
  let dbClient: DatabaseClient;
  let runner: PostgresBookingTransactionRunner;

  const cleanupUsers: string[] = [];
  const cleanupBarbers: string[] = [];
  const cleanupServices: string[] = [];
  const cleanupAppointments: string[] = [];

  let testServiceId: string;
  let testCustomerId: string;
  let testBarber1Id: string;
  let testBarber2Id: string;

  beforeAll(async () => {
    safeDb = await createSafeTestDatabaseContext();
    dbClient = safeDb.dbClient;
    runner = new PostgresBookingTransactionRunner(dbClient.db);

    testServiceId = uuidv7();
    cleanupServices.push(testServiceId);
    await dbClient.db.insert(services).values({
      id: testServiceId,
      name: "Barber Transition Test Service",
      description: "Service for testing barber status transitions",
      durationMinutes: 45,
      priceRupiah: 70000,
      isActive: true,
    });

    // Customer
    testCustomerId = uuidv7();
    cleanupUsers.push(testCustomerId);
    await dbClient.db.insert(users).values({
      id: testCustomerId,
      email: `test-trans-cust-${testCustomerId}@barberkece.test`,
      passwordHash: "dummyhash",
      role: "CUSTOMER",
      status: "ACTIVE",
    });

    // Barber 1
    const barber1UserId = uuidv7();
    cleanupUsers.push(barber1UserId);
    await dbClient.db.insert(users).values({
      id: barber1UserId,
      email: `test-trans-b1-${barber1UserId}@barberkece.test`,
      passwordHash: "dummyhash",
      role: "BARBER",
      status: "ACTIVE",
    });

    testBarber1Id = uuidv7();
    cleanupBarbers.push(testBarber1Id);
    await dbClient.db.insert(barberProfiles).values({
      id: testBarber1Id,
      userId: barber1UserId,
    });

    // Barber 2
    const barber2UserId = uuidv7();
    cleanupUsers.push(barber2UserId);
    await dbClient.db.insert(users).values({
      id: barber2UserId,
      email: `test-trans-b2-${barber2UserId}@barberkece.test`,
      passwordHash: "dummyhash",
      role: "BARBER",
      status: "ACTIVE",
    });

    testBarber2Id = uuidv7();
    cleanupBarbers.push(testBarber2Id);
    await dbClient.db.insert(barberProfiles).values({
      id: testBarber2Id,
      userId: barber2UserId,
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

  let slotCounter = 0;

  async function createTestAppointment(
    barberProfileId: string,
    status: AppointmentStatus = AppointmentStatus.CONFIRMED,
    customStartsAt?: Date,
  ) {
    const id = uuidv7();
    cleanupAppointments.push(id);
    const startsAt =
      customStartsAt ??
      new Date(
        new Date("2026-11-20T08:00:00.000Z").getTime() +
          slotCounter++ * 2 * 60 * 60 * 1000,
      );
    const endsAt = new Date(startsAt.getTime() + 45 * 60 * 1000);

    await dbClient.db.insert(appointments).values({
      id,
      bookingReference: `BK-${id}`,
      customerId: testCustomerId,
      barberProfileId,
      serviceId: testServiceId,
      status,
      startsAt,
      endsAt,
      serviceDurationMinutes: 45,
      priceRupiah: 70000,
      isAutoAssigned: false,
    });

    return { id, startsAt, endsAt };
  }

  it("executes valid operational lifecycle: CONFIRMED -> CHECKED_IN -> IN_SERVICE -> COMPLETED", async () => {
    const { id: apptId } = await createTestAppointment(testBarber1Id);
    const clock = { now: () => new Date("2026-11-20T10:00:00.000Z") };
    const useCase = new TransitionAppointmentStatusUseCase(runner, clock);

    // 1. CONFIRMED -> CHECKED_IN
    const r1 = await useCase.execute({
      appointmentId: apptId,
      barberProfileId: testBarber1Id,
      targetStatus: AppointmentStatus.CHECKED_IN,
    });
    expect(r1.appointment.status).toBe(AppointmentStatus.CHECKED_IN);

    // Verify DB
    const [row1] = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, apptId));
    expect(row1!.status).toBe(AppointmentStatus.CHECKED_IN);

    // 2. CHECKED_IN -> IN_SERVICE
    const r2 = await useCase.execute({
      appointmentId: apptId,
      barberProfileId: testBarber1Id,
      targetStatus: AppointmentStatus.IN_SERVICE,
    });
    expect(r2.appointment.status).toBe(AppointmentStatus.IN_SERVICE);

    // 3. IN_SERVICE -> COMPLETED
    const r3 = await useCase.execute({
      appointmentId: apptId,
      barberProfileId: testBarber1Id,
      targetStatus: AppointmentStatus.COMPLETED,
    });
    expect(r3.appointment.status).toBe(AppointmentStatus.COMPLETED);

    // Verify final DB state
    const [rowFinal] = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, apptId));
    expect(rowFinal!.status).toBe(AppointmentStatus.COMPLETED);
  });

  it("executes CANCELLED_BY_BARBERSHOP with cancellationReason persisted in database", async () => {
    const { id: apptId } = await createTestAppointment(testBarber1Id);
    const clock = { now: () => new Date("2026-11-20T10:00:00.000Z") };
    const useCase = new TransitionAppointmentStatusUseCase(runner, clock);

    const res = await useCase.execute({
      appointmentId: apptId,
      barberProfileId: testBarber1Id,
      targetStatus: AppointmentStatus.CANCELLED_BY_BARBERSHOP,
      cancellationReason: "Barber sudden family emergency",
    });

    expect(res.appointment.status).toBe(
      AppointmentStatus.CANCELLED_BY_BARBERSHOP,
    );
    expect(res.appointment.cancellationReason).toBe(
      "Barber sudden family emergency",
    );

    const [row] = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, apptId));
    expect(row!.status).toBe(AppointmentStatus.CANCELLED_BY_BARBERSHOP);
    expect(row!.cancellationReason).toBe("Barber sudden family emergency");
  });

  it("rejects CANCELLED_BY_BARBERSHOP when cancellationReason is missing or whitespace", async () => {
    const { id: apptId } = await createTestAppointment(testBarber1Id);
    const clock = { now: () => new Date("2026-11-20T10:00:00.000Z") };
    const useCase = new TransitionAppointmentStatusUseCase(runner, clock);

    await expect(
      useCase.execute({
        appointmentId: apptId,
        barberProfileId: testBarber1Id,
        targetStatus: AppointmentStatus.CANCELLED_BY_BARBERSHOP,
      }),
    ).rejects.toThrow(CancellationReasonRequiredError);

    await expect(
      useCase.execute({
        appointmentId: apptId,
        barberProfileId: testBarber1Id,
        targetStatus: AppointmentStatus.CANCELLED_BY_BARBERSHOP,
        cancellationReason: "   ",
      }),
    ).rejects.toThrow(CancellationReasonRequiredError);
  });

  it("enforces NO_SHOW grace period against authoritative clock", async () => {
    const startsAt = new Date("2026-11-25T10:00:00.000Z");
    const { id: apptId } = await createTestAppointment(
      testBarber1Id,
      AppointmentStatus.CONFIRMED,
      startsAt,
    );

    // 14 minutes past start time (grace period is 15 minutes)
    const earlyClock = {
      now: () => new Date("2026-11-25T10:14:00.000Z"),
    };
    const earlyUseCase = new TransitionAppointmentStatusUseCase(
      runner,
      earlyClock,
    );

    await expect(
      earlyUseCase.execute({
        appointmentId: apptId,
        barberProfileId: testBarber1Id,
        targetStatus: AppointmentStatus.NO_SHOW,
      }),
    ).rejects.toThrow(NoShowGracePeriodNotElapsedError);

    // 15 minutes past start time -> Allowed
    const exactClock = {
      now: () => new Date("2026-11-25T10:15:00.000Z"),
    };
    const exactUseCase = new TransitionAppointmentStatusUseCase(
      runner,
      exactClock,
    );

    const res = await exactUseCase.execute({
      appointmentId: apptId,
      barberProfileId: testBarber1Id,
      targetStatus: AppointmentStatus.NO_SHOW,
    });
    expect(res.appointment.status).toBe(AppointmentStatus.NO_SHOW);
  });

  it("rejects transition attempted by a foreign barber", async () => {
    const { id: apptId } = await createTestAppointment(testBarber1Id);
    const clock = { now: () => new Date("2026-11-20T10:00:00.000Z") };
    const useCase = new TransitionAppointmentStatusUseCase(runner, clock);

    await expect(
      useCase.execute({
        appointmentId: apptId,
        barberProfileId: testBarber2Id, // foreign barber!
        targetStatus: AppointmentStatus.CHECKED_IN,
      }),
    ).rejects.toThrow(AppointmentOwnershipError);

    // Verify appointment status did not mutate
    const [row] = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, apptId));
    expect(row!.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it("handles concurrent transition requests cleanly via row-level locking", async () => {
    const { id: apptId } = await createTestAppointment(testBarber1Id);
    const clock = { now: () => new Date("2026-11-20T10:00:00.000Z") };
    const useCase = new TransitionAppointmentStatusUseCase(runner, clock);

    // Two concurrent attempts to transition CONFIRMED -> CHECKED_IN
    const p1 = useCase.execute({
      appointmentId: apptId,
      barberProfileId: testBarber1Id,
      targetStatus: AppointmentStatus.CHECKED_IN,
    });

    const p2 = useCase.execute({
      appointmentId: apptId,
      barberProfileId: testBarber1Id,
      targetStatus: AppointmentStatus.CHECKED_IN,
    });

    const results = await Promise.allSettled([p1, p2]);

    // Exactly one must succeed, and one must be rejected with InvalidAppointmentStatusTransitionError
    // because after the first transaction locks and commits CHECKED_IN, the second reloads the row under lock,
    // sees status is already CHECKED_IN, and CHECKED_IN -> CHECKED_IN is invalid.
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    if (rejected[0].status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(
        InvalidAppointmentStatusTransitionError,
      );
    }

    // Authoritative final state in database is CHECKED_IN
    const [finalRow] = await dbClient.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, apptId));
    expect(finalRow!.status).toBe(AppointmentStatus.CHECKED_IN);
  });
});
