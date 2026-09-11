import { describe, it, expect, vi, beforeEach } from "vitest";
import CustomerAppointmentsPage from "../page";

const {
  mockRequireRole,
  mockFindAppointmentsByCustomerId,
  mockFindAllServices,
  mockFindAllBarbers,
} = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockFindAppointmentsByCustomerId: vi.fn(),
  mockFindAllServices: vi.fn(),
  mockFindAllBarbers: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  getDatabaseClient: () => ({ db: {} }),
}));

vi.mock("@barberkece/database/repositories", () => ({
  PostgresAppointmentRepository: class {
    findByCustomerId = mockFindAppointmentsByCustomerId;
  },
  PostgresServiceRepository: class {
    findAll = mockFindAllServices;
    findActive = mockFindAllServices;
  },
  PostgresBarberProfileRepository: class {
    findAll = mockFindAllBarbers;
  },
}));

describe("CustomerAppointmentsPage (/account/appointments)", () => {
  const customerUser = {
    id: "user-cust-123",
    email: "customer@example.com",
    role: "CUSTOMER",
  };

  const sampleAppointment = {
    id: "app-1",
    bookingReference: "BK-20260915-001",
    customerId: "user-cust-123",
    serviceId: "srv-1",
    barberProfileId: "barber-1",
    status: "CONFIRMED",
    startsAt: new Date("2026-09-15T03:00:00.000Z"),
    endsAt: new Date("2026-09-15T03:45:00.000Z"),
    serviceDurationMinutes: 45,
    priceRupiah: 120000,
    notes: "Potong rapi",
    cancellationReason: null,
    isAutoAssigned: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enforces CUSTOMER role requirement", async () => {
    mockRequireRole.mockRejectedValue(new Error("REDIRECT:/sign-in"));

    await expect(CustomerAppointmentsPage()).rejects.toThrow(
      "REDIRECT:/sign-in",
    );
    expect(mockRequireRole).toHaveBeenCalledWith("CUSTOMER");
  });

  it("queries only current authenticated customer's appointments via use case", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    mockFindAppointmentsByCustomerId.mockResolvedValue([sampleAppointment]);
    mockFindAllServices.mockResolvedValue([
      { id: "srv-1", name: "Classic Cut" },
    ]);
    mockFindAllBarbers.mockResolvedValue([
      { id: "barber-1", specialization: "Fade Specialist" },
    ]);

    const element = await CustomerAppointmentsPage();

    expect(element).toBeDefined();
    expect(mockFindAppointmentsByCustomerId).toHaveBeenCalledWith(
      "user-cust-123",
    );
  });

  it("handles empty appointment list gracefully", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    mockFindAppointmentsByCustomerId.mockResolvedValue([]);
    mockFindAllServices.mockResolvedValue([]);
    mockFindAllBarbers.mockResolvedValue([]);

    const element = await CustomerAppointmentsPage();

    expect(element).toBeDefined();
    expect(mockFindAppointmentsByCustomerId).toHaveBeenCalledWith(
      "user-cust-123",
    );
  });

  it("handles missing service or barber catalog records gracefully without failing", async () => {
    mockRequireRole.mockResolvedValue(customerUser);
    mockFindAppointmentsByCustomerId.mockResolvedValue([sampleAppointment]);
    mockFindAllServices.mockRejectedValue(new Error("DB error"));
    mockFindAllBarbers.mockRejectedValue(new Error("DB error"));

    const element = await CustomerAppointmentsPage();

    expect(element).toBeDefined();
  });
});
