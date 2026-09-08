import { InvalidBookingDateError } from "../errors.js";

const JAKARTA_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * Formats an instant as a Jakarta calendar date string "YYYY-MM-DD"
 * using formatToParts to guarantee machine-independent output.
 */
export function getJakartaCalendarDateString(instant: Date): string {
  const parts = JAKARTA_PARTS_FORMATTER.formatToParts(instant);
  let year = "";
  let month = "";
  let day = "";
  for (const { type, value } of parts) {
    if (type === "year") year = value;
    else if (type === "month") month = value;
    else if (type === "day") day = value;
  }
  return `${year}-${month}-${day}`;
}

/**
 * Validates whether a string is a valid "YYYY-MM-DD" calendar date.
 */
export function isValidCalendarDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Adds an integer number of calendar days to a "YYYY-MM-DD" date string
 * using UTC arithmetic to avoid host timezone or DST interference.
 */
export function addCalendarDaysToDateString(
  dateStr: string,
  daysToAdd: number,
): string {
  if (!isValidCalendarDateString(dateStr)) {
    throw new InvalidBookingDateError(`Invalid date string: ${dateStr}`);
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + daysToAdd, 12, 0, 0));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dayOut = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dayOut}`;
}

export interface DayBoundaries {
  dayStart: Date;
  nextDayStart: Date;
}

/**
 * Returns half-open day range [dayStart, nextDayStart) for a Jakarta calendar day.
 * Both instants represent Jakarta midnight (+07:00).
 * Since Asia/Jakarta has zero DST transitions, nextDayStart is exactly +86,400,000 ms.
 */
export function getJakartaDayBoundaries(dateStr: string): DayBoundaries {
  if (!isValidCalendarDateString(dateStr)) {
    throw new InvalidBookingDateError(`Invalid date string: ${dateStr}`);
  }
  const dayStart = new Date(`${dateStr}T00:00:00.000+07:00`);
  const nextDayStart = new Date(dayStart.getTime() + 86_400_000);
  return { dayStart, nextDayStart };
}

/**
 * Returns the day of the week (0 = Sunday, ..., 6 = Saturday)
 * for the specified Jakarta calendar date.
 */
export function getJakartaDayOfWeek(dateStr: string): number {
  if (!isValidCalendarDateString(dateStr)) {
    throw new InvalidBookingDateError(`Invalid date string: ${dateStr}`);
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.getUTCDay();
}

/**
 * Parses a wall-clock time string ("HH:MM" or "HH:MM:SS") on a Jakarta calendar date
 * into a Date instant at Asia/Jakarta (+07:00).
 */
export function parseJakartaWallClockInstant(
  dateStr: string,
  timeStr: string,
): Date {
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${normalizedTime}.000+07:00`);
}

/**
 * Rounds an instant up to the next 15-minute (:00, :15, :30, :45) wall-clock boundary.
 * Because UTC+07:00 is an exact multiple of 15 minutes, UTC quarter-hour
 * boundaries correspond identically to Jakarta quarter-hour boundaries.
 */
export function ceilToQuarterHourBoundary(instant: Date): Date {
  const ms = instant.getTime();
  const QUARTER_HOUR_MS = 15 * 60 * 1000;
  const remainder =
    ((ms % QUARTER_HOUR_MS) + QUARTER_HOUR_MS) % QUARTER_HOUR_MS;
  if (remainder === 0) {
    return new Date(ms);
  }
  return new Date(ms + (QUARTER_HOUR_MS - remainder));
}
