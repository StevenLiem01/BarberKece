import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  saveBookingDraft,
  getBookingDraft,
  clearBookingDraft,
  BOOKING_DRAFT_STORAGE_KEY,
  BookingDraft,
  isValidBookingDraft,
} from "../booking-draft";

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

describe("Booking Draft Storage Utility", () => {
  let mockStorage: MockStorage;
  const validDraft: BookingDraft = {
    serviceId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    barberProfileId: "f1e2d3c4-b5a6-7890-a234-56789abcdef0",
    date: "2026-09-15",
    startsAt: "2026-09-15T09:00:00.000Z",
    endsAt: "2026-09-15T09:45:00.000Z",
    notes: "Mohon potong rapi untuk acara wisuda",
  };

  beforeEach(() => {
    mockStorage = new MockStorage();
    (globalThis as unknown as { window: unknown }).window = {
      sessionStorage: mockStorage,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("validates draft schema with isValidBookingDraft", () => {
    expect(isValidBookingDraft(validDraft)).toBe(true);
    expect(isValidBookingDraft({ ...validDraft, barberProfileId: null })).toBe(
      true,
    );
    expect(isValidBookingDraft(null)).toBe(false);
    expect(isValidBookingDraft({})).toBe(false);
    expect(isValidBookingDraft({ ...validDraft, serviceId: "not-uuid" })).toBe(
      false,
    );
    expect(isValidBookingDraft({ ...validDraft, date: "15-09-2026" })).toBe(
      false,
    );
    expect(isValidBookingDraft({ ...validDraft, startsAt: "invalid" })).toBe(
      false,
    );
  });

  it("saves and retrieves a valid booking draft with specific barber", () => {
    const success = saveBookingDraft(validDraft);
    expect(success).toBe(true);

    const retrieved = getBookingDraft();
    expect(retrieved).toEqual(validDraft);
  });

  it("saves and retrieves a valid booking draft with null barberProfileId (ANY_AVAILABLE)", () => {
    const anyAvailableDraft: BookingDraft = {
      ...validDraft,
      barberProfileId: null,
      notes: null,
    };

    const success = saveBookingDraft(anyAvailableDraft);
    expect(success).toBe(true);

    const retrieved = getBookingDraft();
    expect(retrieved).toEqual(anyAvailableDraft);
  });

  it("rejects saving an invalid draft missing required fields or with invalid UUID", () => {
    const invalidDraft = {
      serviceId: "not-a-uuid",
      date: "2026-09-15",
    };

    const success = saveBookingDraft(invalidDraft);
    expect(success).toBe(false);
    expect(mockStorage.getItem(BOOKING_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("returns null and purges corrupted/malformed JSON from storage", () => {
    mockStorage.setItem(
      BOOKING_DRAFT_STORAGE_KEY,
      "{ malformed JSON invalid }",
    );

    const retrieved = getBookingDraft();
    expect(retrieved).toBeNull();
    expect(mockStorage.getItem(BOOKING_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("returns null and purges valid JSON that does not match schema", () => {
    mockStorage.setItem(
      BOOKING_DRAFT_STORAGE_KEY,
      JSON.stringify({ someUnrelatedKey: "value" }),
    );

    const retrieved = getBookingDraft();
    expect(retrieved).toBeNull();
    expect(mockStorage.getItem(BOOKING_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("clears stored booking draft cleanly", () => {
    saveBookingDraft(validDraft);
    expect(getBookingDraft()).not.toBeNull();

    clearBookingDraft();
    expect(getBookingDraft()).toBeNull();
    expect(mockStorage.getItem(BOOKING_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("is SSR-safe and returns false / null when window is undefined", () => {
    delete (globalThis as unknown as { window?: unknown }).window;

    expect(saveBookingDraft(validDraft)).toBe(false);
    expect(getBookingDraft()).toBeNull();
    expect(() => clearBookingDraft()).not.toThrow();
  });

  it("gracefully handles storage quota exceptions on setItem", () => {
    vi.spyOn(mockStorage, "setItem").mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });

    const success = saveBookingDraft(validDraft);
    expect(success).toBe(false);
  });
});
