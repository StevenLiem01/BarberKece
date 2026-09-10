export interface CalendarAppointmentInput {
  bookingReference: string;
  serviceName: string;
  barberName?: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
  location?: string;
  notes?: string | null;
}

/**
 * Escapes characters for RFC 5545 iCalendar TEXT values:
 * backslash (\), semicolon (;), comma (,), and newlines.
 */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Formats a Date into standard UTC iCalendar DATE-TIME: YYYYMMDDTHHmmssZ
 */
export function formatIcsDate(dateInput: Date | string): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    throw new Error("Invalid date provided to formatIcsDate");
  }
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * Generates an RFC 5545 compliant .ics string for a confirmed appointment.
 */
export function generateIcsContent(input: CalendarAppointmentInput): string {
  const startUtc = formatIcsDate(input.startsAt);
  const endUtc = formatIcsDate(input.endsAt);
  const stampUtc = formatIcsDate(new Date());

  const summary = escapeIcsText(
    `BarberKece - ${input.serviceName}${input.barberName ? ` bersama ${input.barberName}` : ""}`,
  );

  const descriptionParts = [
    `Kode Reservasi: ${input.bookingReference}`,
    `Layanan: ${input.serviceName}`,
  ];
  if (input.barberName) {
    descriptionParts.push(`Barber: ${input.barberName}`);
  }
  if (input.notes) {
    descriptionParts.push(`Catatan: ${input.notes}`);
  }
  const description = escapeIcsText(descriptionParts.join("\n"));

  const location = escapeIcsText(input.location ?? "BarberKece, Jakarta");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BarberKece//Reservation//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:appointment-${escapeIcsText(input.bookingReference)}@barberkece.com`,
    `DTSTAMP:${stampUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}

/**
 * Triggers a browser download of an .ics calendar file.
 * SSR-safe: returns false if window or document is unavailable.
 */
export function downloadIcsFile(filename: string, icsContent: string): boolean {
  if (typeof window === "undefined" || !window.document) {
    return false;
  }

  try {
    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      filename.endsWith(".ics") ? filename : `${filename}.ics`,
    );
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
