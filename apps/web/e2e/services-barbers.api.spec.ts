import { test, expect } from "@playwright/test";
import {
  createTestStaff,
  createTestCustomer,
  cleanupExactIds,
  assertDevDatabase,
} from "./fixtures/auth.fixture";
import { getDatabaseClient } from "../src/lib/db";
import { schema, sql } from "@barberkece/database";

test.describe("M2 Services & Barbers API E2E", () => {
  const db = getDatabaseClient().db;
  const trackedServiceIds = new Set<string>();
  const trackedBarberProfileIds = new Set<string>();

  test.afterAll(async () => {
    await assertDevDatabase();

    for (const id of trackedBarberProfileIds) {
      await db
        .delete(schema.barberServices)
        .where(sql`${schema.barberServices.barberProfileId} = ${id}`);
      await db
        .delete(schema.barberProfiles)
        .where(sql`${schema.barberProfiles.id} = ${id}`);
    }
    for (const id of trackedServiceIds) {
      await db
        .delete(schema.barberServices)
        .where(sql`${schema.barberServices.serviceId} = ${id}`);
      await db
        .delete(schema.services)
        .where(sql`${schema.services.id} = ${id}`);
    }

    await cleanupExactIds();
  });

  test("Admin Service Management Lifecycle & Public Visibility", async ({
    request,
  }) => {
    // 1. Create admin and customer accounts
    const admin = await createTestStaff("ADMIN");
    const customer = await createTestCustomer();

    // 2. Login as admin to obtain session cookie
    const adminLoginRes = await request.post("/api/v1/auth/login", {
      data: { email: admin.email, password: admin.password },
      headers: { origin: "http://localhost:3000" },
    });
    expect(adminLoginRes.status()).toBe(200);
    const adminHeaders = {
      origin: "http://localhost:3000",
      cookie: adminLoginRes.headers()["set-cookie"] || "",
    };

    // 3. Admin creates a new service
    const createRes = await request.post("/api/v1/admin/services", {
      data: {
        name: "E2E Deluxe Haircut",
        durationMinutes: 45,
        priceRupiah: 120000,
        description: "Premium cut with hot towel",
      },
      headers: adminHeaders,
    });
    expect(createRes.status()).toBe(201);
    const createdService = (await createRes.json()).data;
    expect(createdService.id).toBeDefined();
    expect(createdService.name).toBe("E2E Deluxe Haircut");
    expect(createdService.isActive).toBe(true);
    trackedServiceIds.add(createdService.id);

    // 4. Public can view the active service
    const publicGetRes = await request.get(
      `/api/v1/services/${createdService.id}`,
    );
    expect(publicGetRes.status()).toBe(200);
    const publicService = (await publicGetRes.json()).data;
    expect(publicService.name).toBe("E2E Deluxe Haircut");
    expect(publicService.isActive).toBeUndefined(); // public DTO omits isActive

    // 5. Admin deactivates the service
    const toggleRes = await request.patch(
      `/api/v1/admin/services/${createdService.id}/status`,
      {
        data: { isActive: false },
        headers: adminHeaders,
      },
    );
    expect(toggleRes.status()).toBe(200);
    expect((await toggleRes.json()).data.isActive).toBe(false);

    // 6. Public GET /api/v1/services/[id] now returns 404 (activeOnly filter)
    const publicGetInactiveRes = await request.get(
      `/api/v1/services/${createdService.id}`,
    );
    expect(publicGetInactiveRes.status()).toBe(404);

    // 7. Non-admin (Customer) gets 403 when trying to access admin endpoint
    const customerLoginRes = await request.post("/api/v1/auth/login", {
      data: { email: customer.email, password: customer.password },
      headers: { origin: "http://localhost:3000" },
    });
    expect(customerLoginRes.status()).toBe(200);
    const customerHeaders = {
      origin: "http://localhost:3000",
      cookie: customerLoginRes.headers()["set-cookie"] || "",
    };

    const forbiddenRes = await request.post("/api/v1/admin/services", {
      data: {
        name: "Customer Attempt Cut",
        durationMinutes: 30,
        priceRupiah: 50000,
      },
      headers: customerHeaders,
    });
    expect(forbiddenRes.status()).toBe(403);
  });

  test("Admin Barber Provisioning, Service Assignment & Public DTO Protection", async ({
    request,
  }) => {
    // 1. Create admin, barber user (without profile), and service
    const admin = await createTestStaff("ADMIN");
    const barberUser = await createTestStaff("BARBER");

    const adminLoginRes = await request.post("/api/v1/auth/login", {
      data: { email: admin.email, password: admin.password },
      headers: { origin: "http://localhost:3000" },
    });
    const adminHeaders = {
      origin: "http://localhost:3000",
      cookie: adminLoginRes.headers()["set-cookie"] || "",
    };

    // Create a service for assignment
    const createServiceRes = await request.post("/api/v1/admin/services", {
      data: {
        name: "E2E Beard Grooming",
        durationMinutes: 20,
        priceRupiah: 45000,
      },
      headers: adminHeaders,
    });
    expect(createServiceRes.status()).toBe(201);
    const service = (await createServiceRes.json()).data;
    trackedServiceIds.add(service.id);

    // 2. Provision barber profile
    const provisionRes = await request.post("/api/v1/admin/barbers", {
      data: {
        userId: barberUser.id,
        specialization: "Beard Styling",
      },
      headers: adminHeaders,
    });
    expect(provisionRes.status()).toBe(201);
    const barberProfile = (await provisionRes.json()).data;
    expect(barberProfile.id).toBeDefined();
    expect(barberProfile.userId).toBe(barberUser.id);
    trackedBarberProfileIds.add(barberProfile.id);

    // 3. Duplicate profile for same user returns 409 Conflict
    const dupRes = await request.post("/api/v1/admin/barbers", {
      data: {
        userId: barberUser.id,
        specialization: "Duplicate Attempt",
      },
      headers: adminHeaders,
    });
    expect(dupRes.status()).toBe(409);
    expect((await dupRes.json()).error.code).toBe(
      "BARBER_PROFILE_ALREADY_EXISTS",
    );

    // 4. Assign service to barber (idempotent, returns 200)
    const assignRes = await request.post(
      `/api/v1/admin/barbers/${barberProfile.id}/services`,
      {
        data: { serviceId: service.id },
        headers: adminHeaders,
      },
    );
    expect(assignRes.status()).toBe(200);

    // Second identical assignment returns 200 OK
    const reassignRes = await request.post(
      `/api/v1/admin/barbers/${barberProfile.id}/services`,
      {
        data: { serviceId: service.id },
        headers: adminHeaders,
      },
    );
    expect(reassignRes.status()).toBe(200);

    // 5. Public inspects barber profile and eligible services
    const publicBarberRes = await request.get(
      `/api/v1/barbers/${barberProfile.id}`,
    );
    expect(publicBarberRes.status()).toBe(200);
    const publicBarber = (await publicBarberRes.json()).data;
    expect(publicBarber.specialization).toBe("Beard Styling");
    expect(publicBarber.userId).toBeUndefined(); // internal userId must never leak

    const publicEligibleRes = await request.get(
      `/api/v1/barbers/${barberProfile.id}/services`,
    );
    expect(publicEligibleRes.status()).toBe(200);
    const publicEligible = (await publicEligibleRes.json()).data;
    expect(publicEligible).toHaveLength(1);
    expect(publicEligible[0].name).toBe("E2E Beard Grooming");
    expect(publicEligible[0].isActive).toBeUndefined();

    // 6. Admin removes service from barber
    const removeRes = await request.delete(
      `/api/v1/admin/barbers/${barberProfile.id}/services/${service.id}`,
      { headers: adminHeaders },
    );
    expect(removeRes.status()).toBe(200);

    // 7. Public eligible services is now empty
    const publicEligibleAfterRes = await request.get(
      `/api/v1/barbers/${barberProfile.id}/services`,
    );
    expect(publicEligibleAfterRes.status()).toBe(200);
    expect((await publicEligibleAfterRes.json()).data).toHaveLength(0);
  });
});
