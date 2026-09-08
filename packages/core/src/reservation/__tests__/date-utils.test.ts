import { describe, it, expect } from "vitest";
import {
  getJakartaCalendarDateString,
  isValidCalendarDateString,
  addCalendarDaysToDateString,
  getJakartaDayBoundaries,
  getJakartaDayOfWeek,
  parseJakartaWallClockInstant,
  ceilToQuarterHourBoundary,
} from "../domain/date-utils.js";
import { InvalidBookingDateError } from "../errors.js";

describe("date-utils", () => {
  describe("getJakartaCalendarDateString", () => {
    it("formats instants into Jakarta calendar date YYYY-MM-DD", () => {
      // 2026-09-08 17:00:00 UTC is 2026-09-09 00:00:00 in Asia/Jakarta (+07:00)
      const instant = new Date("2026-09-08T17:00:00.000Z");
      expect(getJakartaCalendarDateString(instant)).toBe("2026-09-09");

      // 2026-09-08 16:59:59 UTC is 2026-09-08 23:59:59 in Asia/Jakarta (+07:00)
      const instantBefore = new Date("2026-09-08T16:59:59.000Z");
      expect(getJakartaCalendarDateString(instantBefore)).toBe("2026-09-08");
    });
  });

  describe("isValidCalendarDateString", () => {
    it("accepts valid ISO calendar dates", () => {
      expect(isValidCalendarDateString("2026-09-08")).toBe(true);
      expect(isValidCalendarDateString("2024-02-29")).toBe(true); // leap year
      expect(isValidCalendarDateString("2026-12-31")).toBe(true);
    });

    it("rejects invalid dates or formats", () => {
      expect(isValidCalendarDateString("2026-02-29")).toBe(false); // non-leap year
      expect(isValidCalendarDateString("2026-04-31")).toBe(false); // April has 30 days
      expect(isValidCalendarDateString("2026-13-01")).toBe(false); // invalid month
      expect(isValidCalendarDateString("2026/09/08")).toBe(false); // invalid separator
      expect(isValidCalendarDateString("invalid")).toBe(false);
      expect(isValidCalendarDateString("")).toBe(false);
    });
  });

  describe("addCalendarDaysToDateString", () => {
    it("adds calendar days across normal days", () => {
      expect(addCalendarDaysToDateString("2026-09-08", 5)).toBe("2026-09-13");
      expect(addCalendarDaysToDateString("2026-09-08", 30)).toBe("2026-10-08");
    });

    it("handles month and leap year boundaries deterministically", () => {
      // Leap year 2024
      expect(addCalendarDaysToDateString("2024-02-28", 1)).toBe("2024-02-29");
      expect(addCalendarDaysToDateString("2024-02-28", 2)).toBe("2024-03-01");

      // Non-leap year 2026
      expect(addCalendarDaysToDateString("2026-02-28", 1)).toBe("2026-03-01");

      // Year boundary
      expect(addCalendarDaysToDateString("2026-12-31", 1)).toBe("2027-01-01");
      expect(addCalendarDaysToDateString("2026-12-31", 90)).toBe("2027-03-31");
    });

    it("throws InvalidBookingDateError on malformed date string", () => {
      expect(() => addCalendarDaysToDateString("bad-date", 5)).toThrow(
        InvalidBookingDateError,
      );
    });
  });

  describe("getJakartaDayBoundaries", () => {
    it("returns [dayStart, nextDayStart) both at Jakarta midnight (+07:00)", () => {
      const { dayStart, nextDayStart } = getJakartaDayBoundaries("2026-09-08");

      expect(dayStart.toISOString()).toBe("2026-09-07T17:00:00.000Z");
      expect(nextDayStart.toISOString()).toBe("2026-09-08T17:00:00.000Z");
      // Exact 24 hours difference (86,400,000 ms)
      expect(nextDayStart.getTime() - dayStart.getTime()).toBe(86_400_000);
    });

    it("throws on invalid date string", () => {
      expect(() => getJakartaDayBoundaries("2026-02-30")).toThrow(
        InvalidBookingDateError,
      );
    });
  });

  describe("getJakartaDayOfWeek", () => {
    it("returns correct day of week (0=Sunday, 6=Saturday)", () => {
      // 2026-09-06 is Sunday (0)
      expect(getJakartaDayOfWeek("2026-09-06")).toBe(0);
      // 2026-09-07 is Monday (1)
      expect(getJakartaDayOfWeek("2026-09-07")).toBe(1);
      // 2026-09-08 is Tuesday (2)
      expect(getJakartaDayOfWeek("2026-09-08")).toBe(2);
      // 2026-09-12 is Saturday (6)
      expect(getJakartaDayOfWeek("2026-09-12")).toBe(6);
    });
  });

  describe("parseJakartaWallClockInstant", () => {
    it("parses HH:MM and HH:MM:SS with explicit +07:00 offset", () => {
      const t1 = parseJakartaWallClockInstant("2026-09-08", "09:00");
      expect(t1.toISOString()).toBe("2026-09-08T02:00:00.000Z");

      const t2 = parseJakartaWallClockInstant("2026-09-08", "09:00:00");
      expect(t2.toISOString()).toBe("2026-09-08T02:00:00.000Z");

      const t3 = parseJakartaWallClockInstant("2026-09-08", "14:30:00");
      expect(t3.toISOString()).toBe("2026-09-08T07:30:00.000Z");
    });
  });

  describe("ceilToQuarterHourBoundary", () => {
    it("leaves exact quarter hours unchanged", () => {
      const t00 = new Date("2026-09-08T09:00:00.000+07:00");
      expect(ceilToQuarterHourBoundary(t00).getTime()).toBe(t00.getTime());

      const t15 = new Date("2026-09-08T09:15:00.000+07:00");
      expect(ceilToQuarterHourBoundary(t15).getTime()).toBe(t15.getTime());

      const t30 = new Date("2026-09-08T09:30:00.000+07:00");
      expect(ceilToQuarterHourBoundary(t30).getTime()).toBe(t30.getTime());

      const t45 = new Date("2026-09-08T09:45:00.000+07:00");
      expect(ceilToQuarterHourBoundary(t45).getTime()).toBe(t45.getTime());
    });

    it("rounds up off-grid times to next quarter hour", () => {
      // 09:07:00 -> 09:15:00
      const t07 = new Date("2026-09-08T09:07:00.000+07:00");
      const rounded07 = ceilToQuarterHourBoundary(t07);
      expect(rounded07.toISOString()).toBe(
        new Date("2026-09-08T09:15:00.000+07:00").toISOString(),
      );

      // 09:15:01 -> 09:30:00
      const t15Plus = new Date("2026-09-08T09:15:01.000+07:00");
      const rounded15Plus = ceilToQuarterHourBoundary(t15Plus);
      expect(rounded15Plus.toISOString()).toBe(
        new Date("2026-09-08T09:30:00.000+07:00").toISOString(),
      );
    });
  });
});
