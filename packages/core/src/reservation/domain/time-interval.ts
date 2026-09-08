import { InvalidTimeIntervalError } from "../errors.js";

export class TimeInterval {
  readonly startsAt: Date;
  readonly endsAt: Date;

  constructor(startsAt: Date, endsAt: Date) {
    if (
      !(startsAt instanceof Date) ||
      !(endsAt instanceof Date) ||
      isNaN(startsAt.getTime()) ||
      isNaN(endsAt.getTime())
    ) {
      throw new InvalidTimeIntervalError(
        "Start and end times must be valid Date instances",
      );
    }

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new InvalidTimeIntervalError(
        "End time must be strictly after start time",
      );
    }

    this.startsAt = new Date(startsAt.getTime());
    this.endsAt = new Date(endsAt.getTime());
  }

  get durationMinutes(): number {
    return Math.round(
      (this.endsAt.getTime() - this.startsAt.getTime()) / 60000,
    );
  }

  /**
   * Half-open [start, end) overlap calculation:
   * this.startsAt < other.endsAt && this.endsAt > other.startsAt
   *
   * Contiguous intervals e.g. [09:00, 10:00) and [10:00, 11:00) do NOT overlap.
   */
  overlaps(other: TimeInterval): boolean {
    return (
      this.startsAt.getTime() < other.endsAt.getTime() &&
      this.endsAt.getTime() > other.startsAt.getTime()
    );
  }

  /**
   * Half-open [start, end) containment check:
   * instant >= this.startsAt && instant < this.endsAt
   */
  contains(instant: Date): boolean {
    if (!(instant instanceof Date) || isNaN(instant.getTime())) {
      return false;
    }
    const t = instant.getTime();
    return t >= this.startsAt.getTime() && t < this.endsAt.getTime();
  }
}
