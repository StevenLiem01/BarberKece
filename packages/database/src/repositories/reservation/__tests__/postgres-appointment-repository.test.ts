import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { createDatabase, DatabaseClient } from "../../../client.js";
import { PostgresAppointmentRepository } from "../postgres-appointment-repository.js";
import { appointments } from "../../../schema/reservation/appointments.js";
import { services } from "../../../schema/reservation/services.js";
import { users } from "../../../schema/identity/users.js";
import { barberProfiles } from "../../../schema/barber/barber_profiles.js";
import {
  AppointmentStatus,
  CustomerBookingConflictError,
  SlotAlreadyBookedError,
  TimeInterval,
} from "@barberkece/core/reservation";

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const candidatePaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
];

for (const envPath of candidatePaths) {
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
      if (process.env["DATABASE_URL"]) {
        break;
      }
    } catch {
      // Ignore
    }
  }
}

const TEST_DB_URL =
  process.env["DATABASE_URL"] ||
  "postgres://barberkece_dev:devpassword@localhost:5432/barberkece_dev";

describe("PostgresAppointmentRepository (GiST Exclusion & Concurrency)", () => {
  let dbClient: DatabaseClient;
  let repository: PostgresAppointmentRepository;

  const testUserIds: string[] = [];
  const testBarberIds: string[] = [];
  const testServiceIds: string[] = [];
  const testAppointmentIds: string[] = [];

  let serviceId: string;
  let customer1Id: string;
  let customer2Id: string;
  let barber1Id: string;
  let barber2Id: string;

  beforeAll(async () => {
    dbClient = createDatabase(TEST_DB_URL);
    repository = new PostgresAppointmentRepository(dbClient.db);

    // Setup test service
    serviceId = uuidv7();
    testServiceIds.push(serviceId);
    await dbClient.db.insert(services).values({
      id: serviceId,
      name: "Classic Cut",
      description: "Test service",
      durationMinutes: 60,
      priceRupiah: 75000,
      isActive: true,
    });

    // Setup customers
    customer1Id = uuidv7();
    customer2Id = uuidv7();
    testUserIds.push(customer1Id, customer2Id);
    await dbClient.db.insert(users).values([
      {
        id: customer1Id,
        email: `cust1-${customer1Id}@test.com`,
        passwordHash: "dummyhash",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
      {
        id: customer2Id,
        email: `cust2-${customer2Id}@test.com`,
        passwordHash: "dummyhash",
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    ]);

    // Setup barbers
    const barberUser1 = uuidv7();
    const barberUser2 = uuidv7();
    testUserIds.push(barberUser1, barberUser2);
    await dbClient.db.insert(users).values([
      {
        id: barberUser1,
        email: `barber1-${barberUser1}@test.com`,
        passwordHash: "dummyhash",
        role: "BARBER",
        status: "ACTIVE",
      },
      {
        id: barberUser2,
        email: `barber2-${barberUser2}@test.com`,
        passwordHash: "dummyhash",
        role: "BARBER",
        status: "ACTIVE",
      },
    ]);

    barber1Id = uuidv7();
    barber2Id = uuidv7();
    testBarberIds.push(barber1Id, barber2Id);
    await dbClient.db.insert(barberProfiles).values([
      {
        id: barber1Id,
        userId: barberUser1,
        specialization: "Fade Master",
      },
      {
        id: barber2Id,
        userId: barberUser2,
        specialization: "Beard Specialist",
      },
    ]);
  });

  afterAll(async () => {
    if (testAppointmentIds.length > 0) {
      await dbClient.db
        .delete(appointments)
        .where(inArray(appointments.id, testAppointmentIds));
    }
    if (testBarberIds.length > 0) {
      await dbClient.db
        .delete(barberProfiles)
        .where(inArray(barberProfiles.id, testBarberIds));
    }
    if (testServiceIds.length > 0) {
      await dbClient.db
        .delete(services)
        .where(inArray(services.id, testServiceIds));
    }
    if (testUserIds.length > 0) {
      await dbClient.db.delete(users).where(inArray(users.id, testUserIds));
    }
    await dbClient.close();
  });

  it("creates a non-overlapping appointment successfully", async () => {
    const id = uuidv7();
    testAppointmentIds.push(id);

    const appt = await repository.createAppointment({
      id,
      bookingReference: `BK-${id}`,
      customerId: customer1Id,
      barberProfileId: barber1Id,
      serviceId,
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date("2026-10-01T09:00:00.000Z"),
      endsAt: new Date("2026-10-01T10:00:00.000Z"),
      serviceDurationMinutes: 60,
      priceRupiah: 75000,
    });

    expect(appt.id).toBe(id);
    expect(appt.status).toBe(AppointmentStatus.CONFIRMED);
    expect(appt.startsAt.toISOString()).toBe("2026-10-01T09:00:00.000Z");
    expect(appt.endsAt.toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });

  it("allows contiguous appointments for the same barber [09:00, 10:00) and [10:00, 11:00)", async () => {
    // 09:00 - 10:00 already booked above by customer1 with barber1
    const id = uuidv7();
    testAppointmentIds.push(id);

    const contiguousAppt = await repository.createAppointment({
      id,
      bookingReference: `BK-${id}`,
      customerId: customer2Id,
      barberProfileId: barber1Id,
      serviceId,
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date("2026-10-01T10:00:00.000Z"),
      endsAt: new Date("2026-10-01T11:00:00.000Z"),
      serviceDurationMinutes: 60,
      priceRupiah: 75000,
    });

    expect(contiguousAppt.id).toBe(id);
  });

  it("rejects overlapping appointment for the same barber and throws SlotAlreadyBookedError", async () => {
    // Attempt to book [09:30, 10:30) which overlaps with both [09:00, 10:00) and [10:00, 11:00)
    const id = uuidv7();
    testAppointmentIds.push(id);

    await expect(
      repository.createAppointment({
        id,
        bookingReference: `BK-${id}`,
        customerId: customer2Id,
        barberProfileId: barber1Id,
        serviceId,
        status: AppointmentStatus.CONFIRMED,
        startsAt: new Date("2026-10-01T09:30:00.000Z"),
        endsAt: new Date("2026-10-01T10:30:00.000Z"),
        serviceDurationMinutes: 60,
        priceRupiah: 75000,
      }),
    ).rejects.toThrow(SlotAlreadyBookedError);
  });

  it("rejects overlapping appointment for the same customer and throws CustomerBookingConflictError", async () => {
    // Customer 1 already has [09:00, 10:00) with Barber 1.
    // Attempt to book Barber 2 during [09:15, 09:45) for Customer 1.
    const id = uuidv7();
    testAppointmentIds.push(id);

    await expect(
      repository.createAppointment({
        id,
        bookingReference: `BK-${id}`,
        customerId: customer1Id,
        barberProfileId: barber2Id, // different barber
        serviceId,
        status: AppointmentStatus.CONFIRMED,
        startsAt: new Date("2026-10-01T09:15:00.000Z"),
        endsAt: new Date("2026-10-01T09:45:00.000Z"),
        serviceDurationMinutes: 30,
        priceRupiah: 75000,
      }),
    ).rejects.toThrow(CustomerBookingConflictError);
  });

  it("allows different barber and different customer to book overlapping intervals", async () => {
    // Barber 2 with Customer 2 at [09:00, 10:00) should succeed concurrently with Barber 1 + Customer 1
    const id = uuidv7();
    testAppointmentIds.push(id);

    const appt = await repository.createAppointment({
      id,
      bookingReference: `BK-${id}`,
      customerId: customer2Id,
      barberProfileId: barber2Id,
      serviceId,
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date("2026-10-01T09:00:00.000Z"),
      endsAt: new Date("2026-10-01T10:00:00.000Z"),
      serviceDurationMinutes: 60,
      priceRupiah: 75000,
    });

    expect(appt.id).toBe(id);
  });

  it("does not block interval when previous appointment is CANCELLED", async () => {
    const cancelId = uuidv7();
    testAppointmentIds.push(cancelId);

    const initial = await repository.createAppointment({
      id: cancelId,
      bookingReference: `BK-${cancelId}`,
      customerId: customer1Id,
      barberProfileId: barber2Id,
      serviceId,
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date("2026-10-01T11:00:00.000Z"),
      endsAt: new Date("2026-10-01T12:00:00.000Z"),
      serviceDurationMinutes: 60,
      priceRupiah: 75000,
    });

    // Cancel appointment
    await repository.updateStatus(
      initial.id,
      AppointmentStatus.CANCELLED_BY_CUSTOMER,
      "Customer plans changed",
    );

    // Now another customer books the exact same slot for Barber 2
    const rebookId = uuidv7();
    testAppointmentIds.push(rebookId);

    const rebooked = await repository.createAppointment({
      id: rebookId,
      bookingReference: `BK-${rebookId}`,
      customerId: customer2Id,
      barberProfileId: barber2Id,
      serviceId,
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date("2026-10-01T11:00:00.000Z"),
      endsAt: new Date("2026-10-01T12:00:00.000Z"),
      serviceDurationMinutes: 60,
      priceRupiah: 75000,
    });

    expect(rebooked.id).toBe(rebookId);
  });

  it("does not block interval when previous appointment is COMPLETED", async () => {
    const compId = uuidv7();
    testAppointmentIds.push(compId);

    const appt = await repository.createAppointment({
      id: compId,
      bookingReference: `BK-${compId}`,
      customerId: customer1Id,
      barberProfileId: barber2Id,
      serviceId,
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date("2026-10-01T12:00:00.000Z"),
      endsAt: new Date("2026-10-01T13:00:00.000Z"),
      serviceDurationMinutes: 60,
      priceRupiah: 75000,
    });

    // Transition CONFIRMED -> CHECKED_IN -> IN_SERVICE -> COMPLETED
    await repository.updateStatus(appt.id, AppointmentStatus.CHECKED_IN);
    await repository.updateStatus(appt.id, AppointmentStatus.IN_SERVICE);
    await repository.updateStatus(appt.id, AppointmentStatus.COMPLETED);

    // Same slot can be reused because GiST only excludes CONFIRMED, CHECKED_IN, IN_SERVICE
    const nextId = uuidv7();
    testAppointmentIds.push(nextId);

    const nextAppt = await repository.createAppointment({
      id: nextId,
      bookingReference: `BK-${nextId}`,
      customerId: customer2Id,
      barberProfileId: barber2Id,
      serviceId,
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date("2026-10-01T12:00:00.000Z"),
      endsAt: new Date("2026-10-01T13:00:00.000Z"),
      serviceDurationMinutes: 60,
      priceRupiah: 75000,
    });

    expect(nextAppt.id).toBe(nextId);
  });

  it("does not block interval when previous appointment is NO_SHOW", async () => {
    const noShowId = uuidv7();
    testAppointmentIds.push(noShowId);

    const appt = await repository.createAppointment({
      id: noShowId,
      bookingReference: `BK-${noShowId}`,
      customerId: customer1Id,
      barberProfileId: barber2Id,
      serviceId,
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date("2026-10-01T13:00:00.000Z"),
      endsAt: new Date("2026-10-01T14:00:00.000Z"),
      serviceDurationMinutes: 60,
      priceRupiah: 75000,
    });

    await repository.updateStatus(appt.id, AppointmentStatus.NO_SHOW);

    const reuseId = uuidv7();
    testAppointmentIds.push(reuseId);

    const reuseAppt = await repository.createAppointment({
      id: reuseId,
      bookingReference: `BK-${reuseId}`,
      customerId: customer2Id,
      barberProfileId: barber2Id,
      serviceId,
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date("2026-10-01T13:00:00.000Z"),
      endsAt: new Date("2026-10-01T14:00:00.000Z"),
      serviceDurationMinutes: 60,
      priceRupiah: 75000,
    });

    expect(reuseAppt.id).toBe(reuseId);
  });

  it("findActiveByBarberAndInterval finds only active overlapping appointments", async () => {
    const searchInterval = new TimeInterval(
      new Date("2026-10-01T08:30:00.000Z"),
      new Date("2026-10-01T09:30:00.000Z"),
    );

    const found = await repository.findActiveByBarberAndInterval(
      barber1Id,
      searchInterval,
    );

    // Should include the 09:00-10:00 appointment
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found.some((a) => a.barberProfileId === barber1Id)).toBe(true);
  });
});
