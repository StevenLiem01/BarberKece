export interface BookingDraft {
  serviceId: string;
  barberProfileId: string | null;
  date: string;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
}

export const BOOKING_DRAFT_STORAGE_KEY = "barberkece_booking_draft";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates whether an unknown value conforms to the transient BookingDraft structure.
 */
export function isValidBookingDraft(data: unknown): data is BookingDraft {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;

  if (typeof d.serviceId !== "string" || !UUID_REGEX.test(d.serviceId)) {
    return false;
  }

  if (
    d.barberProfileId !== null &&
    (typeof d.barberProfileId !== "string" ||
      !UUID_REGEX.test(d.barberProfileId))
  ) {
    return false;
  }

  if (typeof d.date !== "string" || !DATE_REGEX.test(d.date)) {
    return false;
  }

  if (
    typeof d.startsAt !== "string" ||
    isNaN(Date.parse(d.startsAt)) ||
    !d.startsAt.includes("T")
  ) {
    return false;
  }

  if (
    typeof d.endsAt !== "string" ||
    isNaN(Date.parse(d.endsAt)) ||
    !d.endsAt.includes("T")
  ) {
    return false;
  }

  if (
    d.notes !== undefined &&
    d.notes !== null &&
    (typeof d.notes !== "string" || d.notes.length > 500)
  ) {
    return false;
  }

  return true;
}

/**
 * Persists transient booking draft in browser sessionStorage.
 * Returns true if successfully saved, false otherwise (e.g. SSR, quota exceeded, invalid schema).
 */
export function saveBookingDraft(draft: unknown): boolean {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return false;
  }

  if (!isValidBookingDraft(draft)) {
    return false;
  }

  try {
    const sanitized: BookingDraft = {
      serviceId: draft.serviceId,
      barberProfileId: draft.barberProfileId,
      date: draft.date,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      notes:
        typeof draft.notes === "string"
          ? draft.notes.trim()
          : (draft.notes ?? null),
    };

    window.sessionStorage.setItem(
      BOOKING_DRAFT_STORAGE_KEY,
      JSON.stringify(sanitized),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves and validates the transient booking draft from sessionStorage.
 * Returns the parsed BookingDraft or null if absent, malformed, or during SSR.
 * Automatically clears corrupted storage data.
 */
export function getBookingDraft(): BookingDraft | null {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsedJson = JSON.parse(raw);
    if (!isValidBookingDraft(parsedJson)) {
      window.sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
      return null;
    }

    return parsedJson;
  } catch {
    try {
      window.sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * Clears the transient booking draft from sessionStorage.
 * Safe to call in SSR or when storage is empty.
 */
export function clearBookingDraft(): void {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  try {
    window.sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
