import type { BarberWorkloadSummary } from "../ports/appointment-repository.js";

export class FairnessSelector {
  /**
   * Deterministic 3-tier selection for ANY_AVAILABLE barber assignment according to STEP 14.
   *
   * Tier 1: Lowest booked service minutes on the business-local day.
   * Tier 2: Longest since last AUTO assignment (null / never auto-assigned ranks before any timestamp).
   * Tier 3: Stable lexicographical barberProfileId ordering.
   *
   * Zero randomness.
   */
  static selectBarber(candidates: BarberWorkloadSummary[]): string {
    if (candidates.length === 0) {
      throw new Error("Cannot select barber from empty candidate list");
    }
    if (candidates.length === 1) {
      return candidates[0]!.barberProfileId;
    }

    const sorted = [...candidates].sort((a, b) => {
      // Tier 1: Lowest daily booked service minutes
      if (a.bookedServiceMinutes !== b.bookedServiceMinutes) {
        return a.bookedServiceMinutes - b.bookedServiceMinutes;
      }

      // Tier 2: Longest since last AUTO assignment
      // null / never auto-assigned ranks before any timestamp
      if (a.lastAutoAssignedAt === null && b.lastAutoAssignedAt !== null) {
        return -1;
      }
      if (a.lastAutoAssignedAt !== null && b.lastAutoAssignedAt === null) {
        return 1;
      }
      if (a.lastAutoAssignedAt !== null && b.lastAutoAssignedAt !== null) {
        const timeA = a.lastAutoAssignedAt.getTime();
        const timeB = b.lastAutoAssignedAt.getTime();
        if (timeA !== timeB) {
          // Oldest auto-assignment timestamp wins (longest time elapsed since last assignment)
          return timeA - timeB;
        }
      }

      // Tier 3: Stable lexicographical barberProfileId ordering
      return a.barberProfileId.localeCompare(b.barberProfileId);
    });

    return sorted[0]!.barberProfileId;
  }
}
