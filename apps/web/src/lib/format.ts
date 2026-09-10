/**
 * Formats a numeric price into Indonesian Rupiah (e.g. Rp 150.000)
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats an ISO UTC datetime string into Asia/Jakarta time (HH:mm WIB).
 */
export function formatTimeWib(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return isoString.slice(11, 16);
    }
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    }).format(d);
  } catch {
    return isoString.slice(11, 16);
  }
}

/**
 * Formats a YYYY-MM-DD date string into localized Indonesian format
 * (e.g. "Selasa, 15 September 2026").
 */
export function formatDateIndonesian(dateString: string): string {
  try {
    const [year, month, day] = dateString.split("-").map(Number);
    if (!year || !month || !day) {
      return dateString;
    }
    const d = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return dateString;
  }
}
