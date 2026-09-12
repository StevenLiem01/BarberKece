import { BarberAppointmentDto } from "@barberkece/contracts";

/**
 * Returns today's date in Asia/Jakarta timezone formatted as YYYY-MM-DD.
 */
export function getJakartaTodayDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Formats a YYYY-MM-DD string into localized Indonesian format for Asia/Jakarta
 * (e.g. "Sabtu, 12 September 2026").
 */
export function formatJakartaDateIndonesian(dateString: string): string {
  try {
    const [year, month, day] = dateString.split("-").map(Number);
    if (!year || !month || !day) return dateString;
    // Set to midday UTC to avoid any boundary date shifts
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return dateString;
  }
}

/**
 * Sorts appointments chronologically by startsAt ascending, with bookingReference as secondary tie-break.
 */
export function sortAppointmentsChronologically(
  appointments: BarberAppointmentDto[],
): BarberAppointmentDto[] {
  return [...appointments].sort(
    (a, b) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
      a.bookingReference.localeCompare(b.bookingReference),
  );
}

/**
 * Determines whether an appointment has reached a terminal/resolved status.
 */
export function isTerminalStatus(status: string): boolean {
  return (
    status === "COMPLETED" ||
    status === "CANCELLED_BY_CUSTOMER" ||
    status === "CANCELLED_BY_BARBERSHOP" ||
    status === "NO_SHOW"
  );
}

export type SpotlightType =
  "IN_SERVICE" | "CHECKED_IN" | "CONFIRMED_NEXT" | "CONFIRMED_OVERDUE";

export interface SpotlightResult {
  appointment: BarberAppointmentDto | null;
  type: SpotlightType | null;
}

/**
 * Derives the active/next operational spotlight appointment from today's appointments.
 * Priority:
 * 1. IN_SERVICE = active
 * 2. otherwise CHECKED_IN = active/current
 * 3. otherwise nearest future CONFIRMED = next (fallback to earliest pending CONFIRMED)
 * Completed/terminal appointments are excluded and must not become active spotlight.
 */
export function deriveSpotlightAppointment(
  appointments: BarberAppointmentDto[],
  now: number = Date.now(),
): SpotlightResult {
  // Exclude all terminal statuses
  const nonTerminal = appointments.filter((a) => !isTerminalStatus(a.status));

  // 1. IN_SERVICE has highest priority
  const inService = nonTerminal.find((a) => a.status === "IN_SERVICE");
  if (inService) {
    return { appointment: inService, type: "IN_SERVICE" };
  }

  // 2. CHECKED_IN is second priority
  const checkedIn = nonTerminal.find((a) => a.status === "CHECKED_IN");
  if (checkedIn) {
    return { appointment: checkedIn, type: "CHECKED_IN" };
  }

  // 3. nearest future CONFIRMED is third priority
  const confirmed = nonTerminal.filter((a) => a.status === "CONFIRMED");
  if (confirmed.length > 0) {
    const sorted = [...confirmed].sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
        a.bookingReference.localeCompare(b.bookingReference),
    );
    const future = sorted.find((a) => new Date(a.startsAt).getTime() >= now);
    if (future) {
      return { appointment: future, type: "CONFIRMED_NEXT" };
    }
    // Fallback: earliest pending confirmed appointment
    const fallback = sorted[0] ?? null;
    if (fallback && new Date(fallback.startsAt).getTime() < now) {
      return { appointment: fallback, type: "CONFIRMED_OVERDUE" };
    }
    return { appointment: fallback, type: "CONFIRMED_NEXT" };
  }

  // Terminal appointments or empty list do not become active spotlight
  return { appointment: null, type: null };
}

export type OperationalAction =
  "CHECK_IN" | "START_SERVICE" | "COMPLETE" | "NO_SHOW" | "CANCEL";

/**
 * Returns allowed operational actions for a given status.
 * CONFIRMED: Check In, No Show, Cancel by Barbershop
 * CHECKED_IN: Start Service, Cancel by Barbershop
 * IN_SERVICE: Complete
 * Terminal statuses: no mutation action
 */
export function getAllowedOperationalActions(
  status: string,
): OperationalAction[] {
  switch (status) {
    case "CONFIRMED":
      return ["CHECK_IN", "NO_SHOW", "CANCEL"];
    case "CHECKED_IN":
      return ["START_SERVICE", "CANCEL"];
    case "IN_SERVICE":
      return ["COMPLETE"];
    default:
      return [];
  }
}

/**
 * Maps transition API HTTP errors to human-friendly Indonesian error messages.
 */
export function mapTransitionErrorMessage(
  status: number,
  errorData?: { code?: string; message?: string },
): string {
  if (status === 401 || status === 403) {
    return "Sesi Anda telah berakhir atau Anda tidak memiliki akses barber. Silakan masuk kembali.";
  }
  if (status === 404) {
    return "Janji temu tidak ditemukan atau bukan milik jadwal Anda.";
  }
  if (status === 400) {
    const rawMsg = errorData?.message ?? "";
    const lower = rawMsg.toLowerCase();
    if (lower.includes("no_show") || lower.includes("grace period")) {
      return (
        rawMsg ||
        "Tidak dapat menandai Tidak Hadir (No Show) sebelum masa tenggang 15 menit berakhir."
      );
    }
    if (lower.includes("cancellation reason")) {
      return "Alasan pembatalan wajib diisi saat dibatalkan oleh barbershop.";
    }
    if (lower.includes("transition") || lower.includes("status")) {
      return (
        rawMsg ||
        "Transisi status tidak valid. Status janji temu mungkin telah diperbarui dari sesi lain."
      );
    }
    return rawMsg || "Permintaan transisi status tidak valid.";
  }
  return "Terjadi kesalahan server saat memperbarui status janji temu.";
}
