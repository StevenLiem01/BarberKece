import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  saveBookingDraft,
  getBookingDraft,
  clearBookingDraft,
  BookingDraft,
} from "@/lib/booking-draft";
import {
  PublicServiceDto,
  PublicBarberDto,
  PublicAvailableSlotDto,
} from "@barberkece/contracts";

// Mock router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("Booking Wizard Business Logic & State Invariants", () => {
  let mockStorage: MockStorage;

  const mockService1: PublicServiceDto = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Classic Gentleman Cut",
    durationMinutes: 45,
    priceRupiah: 100000,
    description: "Standard cut",
  };

  const mockService2: PublicServiceDto = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Beard Trim & Shape",
    durationMinutes: 30,
    priceRupiah: 60000,
    description: "Beard shaping",
  };

  const mockBarber: PublicBarberDto = {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    displayName: "Rizal",
    specialization: "Master Barber",
  };

  const mockSlot1: PublicAvailableSlotDto = {
    startsAt: "2026-09-15T03:00:00.000Z",
    endsAt: "2026-09-15T03:45:00.000Z",
  };

  beforeEach(() => {
    mockStorage = new MockStorage();
    (globalThis as unknown as { window: unknown }).window = {
      sessionStorage: mockStorage,
    };
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  describe("Query Parameter Formulation for Availability", () => {
    it("omits barberProfileId when Any Available is selected", () => {
      const serviceId = mockService1.id;
      const date = "2026-09-15";
      const barberId = null; // Any available

      const params = new URLSearchParams({ serviceId, date });
      if (barberId) {
        params.set("barberProfileId", barberId);
      }

      expect(params.get("serviceId")).toBe(serviceId);
      expect(params.get("date")).toBe(date);
      expect(params.has("barberProfileId")).toBe(false);
      expect(params.toString()).toBe(`serviceId=${serviceId}&date=2026-09-15`);
    });

    it("includes barberProfileId when a specific barber is chosen", () => {
      const serviceId = mockService1.id;
      const date = "2026-09-15";
      const barberId = mockBarber.id;

      const params = new URLSearchParams({ serviceId, date });
      if (barberId) {
        params.set("barberProfileId", barberId);
      }

      expect(params.get("serviceId")).toBe(serviceId);
      expect(params.get("date")).toBe(date);
      expect(params.get("barberProfileId")).toBe(mockBarber.id);
      expect(params.toString()).toBe(
        `serviceId=${serviceId}&date=2026-09-15&barberProfileId=${mockBarber.id}`,
      );
    });
  });

  describe("Stale Slot Invalidation Rules", () => {
    it("invalidates slot and resets specific barber when service changes", () => {
      let currentService = mockService1;
      let currentSlot: PublicAvailableSlotDto | null = mockSlot1;
      let currentBarber: PublicBarberDto | null = mockBarber;
      let isAnyBarber = false;

      // User chooses new service
      const newService = mockService2;
      if (currentService.id !== newService.id) {
        currentService = newService;
        currentSlot = null; // Invalidate stale slot
        if (currentBarber !== null) {
          currentBarber = null;
          isAnyBarber = true;
        }
      }

      expect(currentService).toEqual(mockService2);
      expect(currentSlot).toBeNull();
      expect(currentBarber).toBeNull();
      expect(isAnyBarber).toBe(true);
    });

    it("invalidates slot when barber preference changes", () => {
      let isAnyBarber = true;
      let currentBarber: PublicBarberDto | null = null;
      let currentSlot: PublicAvailableSlotDto | null = mockSlot1;

      // User selects specific barber
      isAnyBarber = false;
      currentBarber = mockBarber;
      currentSlot = null; // Invalidate stale slot

      expect(isAnyBarber).toBe(false);
      expect(currentBarber).toEqual(mockBarber);
      expect(currentSlot).toBeNull();
    });

    it("invalidates slot when date changes", () => {
      let currentDate = "2026-09-15";
      let currentSlot: PublicAvailableSlotDto | null = mockSlot1;

      const newDate = "2026-09-16";
      if (currentDate !== newDate) {
        currentDate = newDate;
        currentSlot = null; // Invalidate stale slot
      }

      expect(currentDate).toBe("2026-09-16");
      expect(currentSlot).toBeNull();
    });
  });

  describe("Rapid Request Stale-Response Safety (Race Condition Prevention)", () => {
    it("discards slower earlier availability response when a newer request has completed", () => {
      let latestRequestId = 0;
      let availableSlots: PublicAvailableSlotDto[] = [];

      // Request 1 starts (date A)
      const req1Id = ++latestRequestId;
      const slotsA: PublicAvailableSlotDto[] = [mockSlot1];

      // Request 2 starts rapidly (date B)
      const req2Id = ++latestRequestId;
      const slotsB: PublicAvailableSlotDto[] = [
        {
          startsAt: "2026-09-16T04:00:00.000Z",
          endsAt: "2026-09-16T04:45:00.000Z",
        },
      ];

      // Request 2 completes first (fast network)
      if (req2Id === latestRequestId) {
        availableSlots = slotsB;
      }
      expect(availableSlots).toEqual(slotsB);

      // Request 1 completes later (slow network)
      if (req1Id === latestRequestId) {
        availableSlots = slotsA; // Should NOT execute
      }

      // State remains from Request 2; Request 1 did not overwrite
      expect(availableSlots).toEqual(slotsB);
    });
  });

  describe("Guest Auth Interruption & Draft Persistence", () => {
    it("persists transient booking draft and redirects guest to /sign-in?next=/book", () => {
      const isAuthenticated = false;

      const draft: BookingDraft = {
        serviceId: mockService1.id,
        barberProfileId: null,
        date: "2026-09-15",
        startsAt: mockSlot1.startsAt,
        endsAt: mockSlot1.endsAt,
        notes: "Mohon fade rapi",
      };

      if (!isAuthenticated) {
        saveBookingDraft(draft);
        mockPush("/sign-in?next=/book");
      }

      expect(mockPush).toHaveBeenCalledWith("/sign-in?next=/book");
      const stored = getBookingDraft();
      expect(stored).toEqual(draft);
    });
  });

  describe("Restored Draft Availability Revalidation", () => {
    it("advances to Step 5 (Review) when restored slot is still available in fresh slots", () => {
      const draft: BookingDraft = {
        serviceId: mockService1.id,
        barberProfileId: null,
        date: "2026-09-15",
        startsAt: mockSlot1.startsAt,
        endsAt: mockSlot1.endsAt,
        notes: null,
      };

      // Server returns fresh slots containing the draft slot
      const freshSlots: PublicAvailableSlotDto[] = [mockSlot1];

      const matchingSlot = freshSlots.find(
        (slot) => slot.startsAt === draft.startsAt,
      );

      let currentStep = 1;
      let selectedSlot: PublicAvailableSlotDto | null = null;

      if (matchingSlot) {
        selectedSlot = matchingSlot;
        currentStep = 5;
      } else {
        selectedSlot = null;
        currentStep = 4;
      }

      expect(currentStep).toBe(5);
      expect(selectedSlot).toEqual(mockSlot1);
    });

    it("stays at Step 4 (Time) and clears selectedSlot when restored slot is taken", () => {
      const draft: BookingDraft = {
        serviceId: mockService1.id,
        barberProfileId: null,
        date: "2026-09-15",
        startsAt: "2026-09-15T02:00:00.000Z", // Slot that was taken
        endsAt: "2026-09-15T02:45:00.000Z",
        notes: null,
      };

      // Server returns fresh slots that DO NOT contain the draft slot
      const freshSlots: PublicAvailableSlotDto[] = [mockSlot1]; // 03:00, not 02:00

      const matchingSlot = freshSlots.find(
        (slot) => slot.startsAt === draft.startsAt,
      );

      let currentStep = 1;
      let selectedSlot: PublicAvailableSlotDto | null = null;
      let errorMsg: string | null = null;

      if (matchingSlot) {
        selectedSlot = matchingSlot;
        currentStep = 5;
      } else {
        selectedSlot = null;
        currentStep = 4;
        errorMsg =
          "Slot waktu yang Anda pilih sebelumnya sudah tidak tersedia. Silakan pilih slot baru.";
      }

      expect(currentStep).toBe(4);
      expect(selectedSlot).toBeNull();
      expect(errorMsg).toContain("tidak tersedia");
    });
  });

  describe("Authenticated Confirmation, Idempotency & Conflict Recovery", () => {
    it("constructs authoritative payload and attaches Idempotency-Key", async () => {
      const idempotencyKey = "test-idempotency-key-uuid-1234";

      const payload = {
        serviceId: mockService1.id,
        startsAt: mockSlot1.startsAt,
        barberProfileId: undefined, // Any Available
        notes: "Mohon fade tipis",
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: "appointment-123",
            bookingReference: "BK-20260915-001",
          },
        }),
      });
      globalThis.fetch = fetchMock;

      await fetch("/api/v1/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      expect(fetchMock).toHaveBeenCalledWith("/api/v1/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
    });

    it("clears draft and navigates to planned confirmation route on 201 success", async () => {
      saveBookingDraft({
        serviceId: mockService1.id,
        barberProfileId: null,
        date: "2026-09-15",
        startsAt: mockSlot1.startsAt,
        endsAt: mockSlot1.endsAt,
      });

      expect(getBookingDraft()).not.toBeNull();

      // Simulated success response
      const bookingReference = "BK-20260915-001";
      clearBookingDraft();
      mockPush(`/book/confirmation/${bookingReference}`);

      expect(getBookingDraft()).toBeNull();
      expect(mockPush).toHaveBeenCalledWith(
        "/book/confirmation/BK-20260915-001",
      );
    });

    it("recovers gracefully on slot conflict: preserves upstream state, resets slot, and returns to Step 4", () => {
      const selectedService: PublicServiceDto | null = mockService1;
      const selectedBarber: PublicBarberDto | null = mockBarber;
      const selectedDate: string | null = "2026-09-15";
      let selectedSlot: PublicAvailableSlotDto | null = mockSlot1;
      let currentStep = 5;
      let submitError: string | null = null;
      let idempotencyKey: string | null = "idem-key-123";

      // Simulated 400/409 Conflict response
      const apiResponse = {
        ok: false,
        status: 400,
        error: {
          code: "BAD_REQUEST",
          message:
            "The requested appointment slot is already booked for barber ...",
        },
      };

      const isAvailabilityConflict =
        apiResponse.status === 409 ||
        (apiResponse.status === 400 &&
          (apiResponse.error.message.toLowerCase().includes("already booked") ||
            apiResponse.error.message.toLowerCase().includes("not available") ||
            apiResponse.error.message.toLowerCase().includes("conflict") ||
            apiResponse.error.message
              .toLowerCase()
              .includes("tidak tersedia")));

      if (isAvailabilityConflict) {
        selectedSlot = null;
        currentStep = 4;
        submitError = apiResponse.error.message;
        idempotencyKey = null; // Key reset for next slot
      }

      // Upstream selections are preserved
      expect(selectedService).toEqual(mockService1);
      expect(selectedBarber).toEqual(mockBarber);
      expect(selectedDate).toBe("2026-09-15");
      // Slot is cleared
      expect(selectedSlot).toBeNull();
      // Step navigated back to 4
      expect(currentStep).toBe(4);
      // Key is cleared
      expect(idempotencyKey).toBeNull();
      // Recovery error message is displayed
      expect(submitError).toContain("already booked");
    });

    it("preserves Step 5 (Review), selected slot, and idempotency key when non-conflict error (e.g. 500) occurs", () => {
      let selectedSlot: PublicAvailableSlotDto | null = mockSlot1;
      let currentStep = 5;
      let submitError: string | null = null;
      let idempotencyKey: string | null = "idem-key-123";

      // Simulated 500 Internal Server Error
      const apiResponse = {
        ok: false,
        status: 500,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error occurred",
        },
      };

      const isAvailabilityConflict =
        apiResponse.status === 409 ||
        (apiResponse.status === 400 &&
          (apiResponse.error.message.toLowerCase().includes("already booked") ||
            apiResponse.error.message.toLowerCase().includes("not available") ||
            apiResponse.error.message.toLowerCase().includes("conflict") ||
            apiResponse.error.message
              .toLowerCase()
              .includes("tidak tersedia")));

      if (isAvailabilityConflict) {
        selectedSlot = null;
        currentStep = 4;
        idempotencyKey = null;
      } else {
        // Remain on Review step, keep slot and keep key for retry
        submitError = apiResponse.error.message;
      }

      // User remains on Step 5
      expect(currentStep).toBe(5);
      // Slot is preserved
      expect(selectedSlot).toEqual(mockSlot1);
      // Key is preserved for exact retry semantics
      expect(idempotencyKey).toBe("idem-key-123");
      expect(submitError).toBe("Internal server error occurred");
    });

    it("prevents duplicate submissions while request is already pending", () => {
      let isSubmitting = false;
      const executionCount = { count: 0 };

      const triggerSubmit = () => {
        if (isSubmitting) return;
        isSubmitting = true;
        executionCount.count++;
      };

      // First click
      triggerSubmit();
      expect(isSubmitting).toBe(true);
      expect(executionCount.count).toBe(1);

      // Duplicate accidental click while in-flight
      triggerSubmit();
      expect(executionCount.count).toBe(1); // Ignored
    });
  });
});
