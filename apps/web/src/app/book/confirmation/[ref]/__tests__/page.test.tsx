import { describe, it, expect, vi, beforeEach } from "vitest";
import BookingConfirmationPage from "../page";

const {
  mockGetAuthenticatedUser,
  mockRedirect,
  mockNotFound,
  mockFindAppointmentById,
  mockFindAppointmentsByCustomerId,
  mockFindServiceById,
  mockFindBarberById,
} = vi.hoisted(() => ({
  mockGetAuthenticatedUser: vi.fn(),
  mockRedirect: vi.fn(),
  mockNotFound: vi.fn(),
  mockFindAppointmentById: vi.fn(),
  mockFindAppointmentsByCustomerId: vi.fn(),
  mockFindServiceById: vi.fn(),
  mockFindBarberById: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
}));

vi.mock("@/lib/db", () => ({
  getDatabaseClient: () => ({ db: {} }),
}));

vi.mock("@barberkece/database/repositories", () => {
  return {
    PostgresAppointmentRepository: class {
      findById = mockFindAppointmentById;
      findByCustomerId = mockFindAppointmentsByCustomerId;
    },
    PostgresServiceRepository: class {
      findById = mockFindServiceById;
    },
    PostgresBarberProfileRepository: class {
      findById = mockFindBarberById;
    },
  };
});

describe("BookingConfirmationPage (/book/confirmation/[ref])", () => {
  const customerUser = {
    id: "user-cust-1",
    email: "customer@example.com",
    role: "CUSTOMER",
  };

  const ownedAppointment = {
    id: "33333333-3333-4333-8333-333333333333",
    bookingReference: "BK-20260915-001",
    customerId: "user-cust-1",
    serviceId: "service-uuid-1",
    barberProfileId: "barber-uuid-1",
    status: "CONFIRMED",
    startsAt: new Date("2026-09-15T03:00:00.000Z"),
    endsAt: new Date("2026-09-15T03:45:00.000Z"),
    serviceDurationMinutes: 45,
    priceRupiah: 100000,
    notes: "Potong rapi",
    isAutoAssigned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const otherCustomerAppointment = {
    id: "44444444-4444-4444-8444-444444444444",
    bookingReference: "BK-20260915-999",
    customerId: "user-other-customer",
    serviceId: "service-uuid-1",
    barberProfileId: "barber-uuid-1",
    status: "CONFIRMED",
    startsAt: new Date("2026-09-15T04:00:00.000Z"),
    endsAt: new Date("2026-09-15T04:45:00.000Z"),
    serviceDurationMinutes: 45,
    priceRupiah: 100000,
    notes: null,
    isAutoAssigned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
    mockNotFound.mockImplementation(() => {
      throw new Error("NOT_FOUND");
    });
  });

  describe("Authentication & Role Authorization", () => {
    it("redirects unauthenticated visitor to /sign-in?next=/book/confirmation/[ref]", async () => {
      mockGetAuthenticatedUser.mockResolvedValue(null);

      await expect(
        BookingConfirmationPage({
          params: Promise.resolve({ ref: "BK-20260915-001" }),
        }),
      ).rejects.toThrow(
        "REDIRECT:/sign-in?next=/book/confirmation/BK-20260915-001",
      );

      expect(mockRedirect).toHaveBeenCalledWith(
        "/sign-in?next=/book/confirmation/BK-20260915-001",
      );
    });

    it("triggers notFound() when authenticated user has non-CUSTOMER role (BARBER)", async () => {
      mockGetAuthenticatedUser.mockResolvedValue({
        id: "user-barber-1",
        email: "barber@example.com",
        role: "BARBER",
      });

      await expect(
        BookingConfirmationPage({
          params: Promise.resolve({ ref: "BK-20260915-001" }),
        }),
      ).rejects.toThrow("NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("triggers notFound() when authenticated user has non-CUSTOMER role (ADMIN)", async () => {
      mockGetAuthenticatedUser.mockResolvedValue({
        id: "user-admin-1",
        email: "admin@example.com",
        role: "ADMIN",
      });

      await expect(
        BookingConfirmationPage({
          params: Promise.resolve({ ref: "BK-20260915-001" }),
        }),
      ).rejects.toThrow("NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  describe("Reference Resolution & IDOR Defense", () => {
    it("resolves owned appointment by bookingReference within customer's own appointments", async () => {
      mockGetAuthenticatedUser.mockResolvedValue(customerUser);
      mockFindAppointmentsByCustomerId.mockResolvedValue([ownedAppointment]);
      mockFindServiceById.mockResolvedValue({
        id: "service-uuid-1",
        name: "Classic Gentleman Cut",
      });
      mockFindBarberById.mockResolvedValue({
        id: "barber-uuid-1",
        specialization: "Senior Stylist",
      });

      const element = await BookingConfirmationPage({
        params: Promise.resolve({ ref: "BK-20260915-001" }),
      });

      expect(element).toBeDefined();
      expect(mockFindAppointmentsByCustomerId).toHaveBeenCalledWith(
        "user-cust-1",
      );
    });

    it("resolves owned appointment by appointment UUID with ownership verification", async () => {
      mockGetAuthenticatedUser.mockResolvedValue(customerUser);
      mockFindAppointmentById.mockResolvedValue(ownedAppointment);
      mockFindServiceById.mockResolvedValue({
        id: "service-uuid-1",
        name: "Classic Gentleman Cut",
      });
      mockFindBarberById.mockResolvedValue({
        id: "barber-uuid-1",
        specialization: "Senior Stylist",
      });

      const element = await BookingConfirmationPage({
        params: Promise.resolve({
          ref: "33333333-3333-4333-8333-333333333333",
        }),
      });

      expect(element).toBeDefined();
      expect(mockFindAppointmentById).toHaveBeenCalledWith(
        "33333333-3333-4333-8333-333333333333",
      );
    });

    it("blocks access and calls notFound() if appointment UUID belongs to ANOTHER customer (IDOR protection)", async () => {
      mockGetAuthenticatedUser.mockResolvedValue(customerUser); // user-cust-1
      // otherCustomerAppointment has customerId: "user-other-customer"
      mockFindAppointmentById.mockResolvedValue(otherCustomerAppointment);
      mockFindAppointmentsByCustomerId.mockResolvedValue([ownedAppointment]);

      await expect(
        BookingConfirmationPage({
          params: Promise.resolve({
            ref: "44444444-4444-4444-8444-444444444444",
          }),
        }),
      ).rejects.toThrow("NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("blocks access and calls notFound() if bookingReference belongs to ANOTHER customer", async () => {
      mockGetAuthenticatedUser.mockResolvedValue(customerUser);
      // Customer's list contains only ownedAppointment, NOT BK-20260915-999
      mockFindAppointmentsByCustomerId.mockResolvedValue([ownedAppointment]);

      await expect(
        BookingConfirmationPage({
          params: Promise.resolve({ ref: "BK-20260915-999" }),
        }),
      ).rejects.toThrow("NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("calls notFound() when reference does not exist", async () => {
      mockGetAuthenticatedUser.mockResolvedValue(customerUser);
      mockFindAppointmentsByCustomerId.mockResolvedValue([]);

      await expect(
        BookingConfirmationPage({
          params: Promise.resolve({ ref: "NON-EXISTENT" }),
        }),
      ).rejects.toThrow("NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalled();
    });

    it("handles missing service catalog record gracefully with fallback name", async () => {
      mockGetAuthenticatedUser.mockResolvedValue(customerUser);
      mockFindAppointmentsByCustomerId.mockResolvedValue([ownedAppointment]);
      mockFindServiceById.mockResolvedValue(null); // Service not found
      mockFindBarberById.mockResolvedValue({
        id: "barber-uuid-1",
        specialization: "Senior Stylist",
      });

      const element = await BookingConfirmationPage({
        params: Promise.resolve({ ref: "BK-20260915-001" }),
      });

      expect(element).toBeDefined();
    });

    it("handles null barberProfileId gracefully without error", async () => {
      const autoAssignedNoBarber = {
        ...ownedAppointment,
        barberProfileId: null,
        isAutoAssigned: true,
      };

      mockGetAuthenticatedUser.mockResolvedValue(customerUser);
      mockFindAppointmentsByCustomerId.mockResolvedValue([
        autoAssignedNoBarber,
      ]);
      mockFindServiceById.mockResolvedValue({
        id: "service-uuid-1",
        name: "Classic Gentleman Cut",
      });

      const element = await BookingConfirmationPage({
        params: Promise.resolve({ ref: "BK-20260915-001" }),
      });

      expect(element).toBeDefined();
      expect(mockFindBarberById).not.toHaveBeenCalled();
    });
  });
});
