import { describe, it, expect } from "vitest";
import { TimeInterval } from "../domain/time-interval.js";
import { InvalidTimeIntervalError } from "../errors.js";

describe("TimeInterval", () => {
  it("creates a valid TimeInterval and calculates duration in minutes", () => {
    const start = new Date("2026-09-10T09:00:00.000Z");
    const end = new Date("2026-09-10T10:00:00.000Z");

    const interval = new TimeInterval(start, end);

    expect(interval.startsAt.toISOString()).toBe(start.toISOString());
    expect(interval.endsAt.toISOString()).toBe(end.toISOString());
    expect(interval.durationMinutes).toBe(60);
  });

  it("throws InvalidTimeIntervalError when end time is equal to start time (zero duration)", () => {
    const instant = new Date("2026-09-10T09:00:00.000Z");

    expect(() => new TimeInterval(instant, instant)).toThrow(
      InvalidTimeIntervalError,
    );
  });

  it("throws InvalidTimeIntervalError when end time is before start time (reversed interval)", () => {
    const start = new Date("2026-09-10T10:00:00.000Z");
    const end = new Date("2026-09-10T09:00:00.000Z");

    expect(() => new TimeInterval(start, end)).toThrow(
      InvalidTimeIntervalError,
    );
  });

  it("throws InvalidTimeIntervalError when dates are invalid", () => {
    const valid = new Date("2026-09-10T09:00:00.000Z");
    const invalid = new Date("invalid date");

    expect(() => new TimeInterval(valid, invalid)).toThrow(
      InvalidTimeIntervalError,
    );
    expect(() => new TimeInterval(invalid, valid)).toThrow(
      InvalidTimeIntervalError,
    );
  });

  describe("half-open [start, end) overlap semantics", () => {
    const a = new TimeInterval(
      new Date("2026-09-10T09:00:00.000Z"),
      new Date("2026-09-10T10:00:00.000Z"),
    );

    it("contiguous intervals [09:00, 10:00) and [10:00, 11:00) do NOT overlap", () => {
      const b = new TimeInterval(
        new Date("2026-09-10T10:00:00.000Z"),
        new Date("2026-09-10T11:00:00.000Z"),
      );

      expect(a.overlaps(b)).toBe(false);
      expect(b.overlaps(a)).toBe(false);
    });

    it("overlapping intervals [09:00, 10:00) and [09:30, 10:30) DO overlap", () => {
      const b = new TimeInterval(
        new Date("2026-09-10T09:30:00.000Z"),
        new Date("2026-09-10T10:30:00.000Z"),
      );

      expect(a.overlaps(b)).toBe(true);
      expect(b.overlaps(a)).toBe(true);
    });

    it("enclosing intervals [08:30, 10:30) and [09:00, 10:00) DO overlap", () => {
      const b = new TimeInterval(
        new Date("2026-09-10T08:30:00.000Z"),
        new Date("2026-09-10T10:30:00.000Z"),
      );

      expect(a.overlaps(b)).toBe(true);
      expect(b.overlaps(a)).toBe(true);
    });

    it("strictly separated intervals do NOT overlap", () => {
      const b = new TimeInterval(
        new Date("2026-09-10T11:00:00.000Z"),
        new Date("2026-09-10T12:00:00.000Z"),
      );

      expect(a.overlaps(b)).toBe(false);
      expect(b.overlaps(a)).toBe(false);
    });
  });

  describe("half-open [start, end) containment", () => {
    const interval = new TimeInterval(
      new Date("2026-09-10T09:00:00.000Z"),
      new Date("2026-09-10T10:00:00.000Z"),
    );

    it("contains the exact start instant", () => {
      expect(interval.contains(new Date("2026-09-10T09:00:00.000Z"))).toBe(
        true,
      );
    });

    it("contains an interior instant", () => {
      expect(interval.contains(new Date("2026-09-10T09:30:00.000Z"))).toBe(
        true,
      );
    });

    it("does NOT contain the boundary end instant (half-open boundary)", () => {
      expect(interval.contains(new Date("2026-09-10T10:00:00.000Z"))).toBe(
        false,
      );
    });

    it("does NOT contain an instant before start", () => {
      expect(interval.contains(new Date("2026-09-10T08:59:59.999Z"))).toBe(
        false,
      );
    });

    it("returns false for invalid date", () => {
      expect(interval.contains(new Date("invalid"))).toBe(false);
    });
  });
});
