import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import CustomerAppointmentDetailPage from "../page";

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

const {
  mockRequireRole,
  mockNotFound,
  mockFindAppointmentById,
  mockFindServiceById,
  mockFindBarberById,
} = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockNotFound: vi.fn(),
  mockFindAppointmentById: vi.fn(),
  mockFindServiceById: vi.fn(),
  mockFindBarberById: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  getDatabaseClient: () => ({ db: {} }),
}));

vi.mock("@barberkece/database/repositories", () => ({
  PostgresAppointmentRepository: class {
    findById = mockFindAppointmentById;
  },
  PostgresServiceRepository: class {
    findById = mockFindServiceById;
  },
  PostgresBarberProfileRepository: class {
    findById = mockFindBarberById;
  },
}));

describe("CustomerAppointmentDetailPage (/account/appointments/[id])", () => {
  const customerUser = {
    id: "user-cust-1",
    email: "customer@example.com",
    role: "CUSTOMER",
  };

  const ownedAppointment = {
    id: "app-uuid-111",
    bookingReference: "BK-20260915-001",
    customerId: "user-cust-1",
    serviceId: "srv-uuid-1",
    barberProfileId: "barber-uuid-1",
    status: "CONFIRMED",
    startsAt: new Date("2026-09-15T03:00:00.000Z"),
    endsAt: new Date("2026-09-15T03:45:00.000Z"),
    serviceDurationMinutes: 45,
    priceRupiah: 120000,
    notes: "Potong rapi samping pendek",
    cancellationReason: null,
    isAutoAssigned: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const otherCustomerAppointment = {
    id: "app-uuid-999",
    bookingReference: "BK-20260915-999",
    customerId: "user-other-customer",
    serviceId: "srv-uuid-1",
    barberProfileId: "barber-uuid-1",
    status: "CONFIRMED",
    startsAt: new Date("2026-09-15T04:00:00.000Z"),
    endsAt: new Date("2026-09-15T04:45:00.000Z"),
    serviceDurationMinutes: 45,
    priceRupiah: 120000,
    notes: null,
    cancellationReason: null,
    isAutoAssigned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error("NOT_FOUND");
    });
  });

  it("enforces CUSTOMER role requirement", async () => {
    mockRequireRole.mockRejectedValue(new Error("REDIRECT:/sign-in"));

    await expect(
      CustomerAppointmentDetailPage({
        params: Promise.resolve({ id: "app-uuid-111" }),
      }),
    ).rejects.toThrow("REDIRECT:/sign-in");

    expect(mockRequireRole).toHaveBeenCalledWith("CUSTOMER");
  });

  it("renders detail for appointment owned by customer", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    mockFindAppointmentById.mockResolvedValue(ownedAppointment);
    mockFindServiceById.mockResolvedValue({
      id: "srv-uuid-1",
      name: "Gentlemen Classic Cut",
    });
    mockFindBarberById.mockResolvedValue({
      id: "barber-uuid-1",
      specialization: "Senior Stylist",
    });

    const element = await CustomerAppointmentDetailPage({
      params: Promise.resolve({ id: "app-uuid-111" }),
    });

    expect(element).toBeDefined();
    expect(mockFindAppointmentById).toHaveBeenCalledWith("app-uuid-111");
  });

  it("blocks IDOR access and calls notFound() when appointment belongs to another customer", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    // Returns appointment belonging to user-other-customer
    mockFindAppointmentById.mockResolvedValue(otherCustomerAppointment);

    await expect(
      CustomerAppointmentDetailPage({
        params: Promise.resolve({ id: "app-uuid-999" }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound() when appointment does not exist", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    mockFindAppointmentById.mockResolvedValue(null);

    await expect(
      CustomerAppointmentDetailPage({
        params: Promise.resolve({ id: "non-existent" }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalled();
  });

  it("handles missing service and barber gracefully with fallbacks", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    mockFindAppointmentById.mockResolvedValue({
      ...ownedAppointment,
      barberProfileId: null,
    });
    mockFindServiceById.mockResolvedValue(null);

    const element = await CustomerAppointmentDetailPage({
      params: Promise.resolve({ id: "app-uuid-111" }),
    });

    expect(element).toBeDefined();
  });

  it("renders cancellation reason when present", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    mockFindAppointmentById.mockResolvedValue({
      ...ownedAppointment,
      status: "CANCELLED_BY_CUSTOMER",
      cancellationReason: "Ada keperluan mendadak",
    });
    mockFindServiceById.mockResolvedValue({
      id: "srv-uuid-1",
      name: "Gentlemen Classic Cut",
    });
    mockFindBarberById.mockResolvedValue(null);

    const element = await CustomerAppointmentDetailPage({
      params: Promise.resolve({ id: "app-uuid-111" }),
    });

    expect(element).toBeDefined();
  });

  it("does not render any fabricated location text and preserves snapshot price", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    mockFindAppointmentById.mockResolvedValue(ownedAppointment);
    mockFindServiceById.mockResolvedValue({
      id: "srv-uuid-1",
      name: "Gentlemen Classic Cut",
    });
    mockFindBarberById.mockResolvedValue(null);

    const element = await CustomerAppointmentDetailPage({
      params: Promise.resolve({ id: "app-uuid-111" }),
    });

    expect(element).toBeDefined();
    const html = renderClean(element);
    expect(html).toContain("Rp 120.000");
    expect(html).not.toContain("Jl.");
    expect(html).not.toContain("Jakarta");
    expect(html).not.toContain("Mall");
  });

  it("renders 'Batalkan Reservasi' and 'Ubah Jadwal' actions for CONFIRMED appointment with assigned barber", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    mockFindAppointmentById.mockResolvedValue(ownedAppointment);
    mockFindServiceById.mockResolvedValue({
      id: "srv-uuid-1",
      name: "Gentlemen Classic Cut",
    });
    mockFindBarberById.mockResolvedValue({
      id: "barber-uuid-1",
      specialization: "Senior Stylist",
    });

    const element = await CustomerAppointmentDetailPage({
      params: Promise.resolve({ id: "app-uuid-111" }),
    });

    const html = renderClean(element);
    expect(html).toContain("Batalkan Reservasi");
    expect(html).toContain("Ubah Jadwal");
  });

  it("safely blocks and hides 'Ubah Jadwal' action when barberProfileId is unexpectedly absent", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    mockFindAppointmentById.mockResolvedValue({
      ...ownedAppointment,
      barberProfileId: null,
    });
    mockFindServiceById.mockResolvedValue({
      id: "srv-uuid-1",
      name: "Gentlemen Classic Cut",
    });
    mockFindBarberById.mockResolvedValue(null);

    const element = await CustomerAppointmentDetailPage({
      params: Promise.resolve({ id: "app-uuid-111" }),
    });

    const html = renderClean(element);
    expect(html).toContain("Batalkan Reservasi");
    expect(html).not.toContain("Ubah Jadwal");
  });

  it("does not render 'Batalkan Reservasi' or 'Ubah Jadwal' action for already cancelled or completed appointment", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    mockFindAppointmentById.mockResolvedValue({
      ...ownedAppointment,
      status: "CANCELLED_BY_CUSTOMER",
      cancellationReason: "Sudah dibatalkan",
    });
    mockFindServiceById.mockResolvedValue({
      id: "srv-uuid-1",
      name: "Gentlemen Classic Cut",
    });
    mockFindBarberById.mockResolvedValue(null);

    const element = await CustomerAppointmentDetailPage({
      params: Promise.resolve({ id: "app-uuid-111" }),
    });

    const html = renderClean(element);
    expect(html).not.toContain("Batalkan Reservasi");
    expect(html).not.toContain("Ubah Jadwal");
  });
});
