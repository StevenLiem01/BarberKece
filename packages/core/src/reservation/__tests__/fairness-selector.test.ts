import { describe, it, expect } from "vitest";
import { FairnessSelector } from "../domain/fairness-selector.js";
import type { BarberWorkloadSummary } from "../ports/appointment-repository.js";

describe("FairnessSelector", () => {
  it("throws when candidates array is empty", () => {
    expect(() => FairnessSelector.selectBarber([])).toThrow(
      "Cannot select barber from empty candidate list",
    );
  });

  it("returns the only barber when single candidate provided", () => {
    const candidate: BarberWorkloadSummary = {
      barberProfileId: "barber-single",
      bookedServiceMinutes: 60,
      lastAutoAssignedAt: new Date(),
    };

    expect(FairnessSelector.selectBarber([candidate])).toBe("barber-single");
  });

  it("Tier 1: selects barber with lowest booked service minutes on that day", () => {
    const candidates: BarberWorkloadSummary[] = [
      {
        barberProfileId: "barber-busy",
        bookedServiceMinutes: 90,
        lastAutoAssignedAt: null,
      },
      {
        barberProfileId: "barber-light",
        bookedServiceMinutes: 30,
        lastAutoAssignedAt: new Date("2026-09-08T10:00:00.000Z"),
      },
      {
        barberProfileId: "barber-moderate",
        bookedServiceMinutes: 60,
        lastAutoAssignedAt: null,
      },
    ];

    expect(FairnessSelector.selectBarber(candidates)).toBe("barber-light");
  });

  it("Tier 2: prefers barber with null (never auto-assigned) over any prior auto-assignment timestamp when minutes tied", () => {
    const candidates: BarberWorkloadSummary[] = [
      {
        barberProfileId: "barber-assigned-earlier",
        bookedServiceMinutes: 60,
        lastAutoAssignedAt: new Date("2026-09-08T08:00:00.000Z"),
      },
      {
        barberProfileId: "barber-never-assigned",
        bookedServiceMinutes: 60,
        lastAutoAssignedAt: null,
      },
    ];

    expect(FairnessSelector.selectBarber(candidates)).toBe(
      "barber-never-assigned",
    );
  });

  it("Tier 2: selects barber with oldest auto-assignment timestamp (longest time elapsed) when minutes tied", () => {
    const candidates: BarberWorkloadSummary[] = [
      {
        barberProfileId: "barber-recent",
        bookedServiceMinutes: 60,
        lastAutoAssignedAt: new Date("2026-09-08T11:00:00.000Z"),
      },
      {
        barberProfileId: "barber-older",
        bookedServiceMinutes: 60,
        lastAutoAssignedAt: new Date("2026-09-08T09:00:00.000Z"),
      },
      {
        barberProfileId: "barber-moderate",
        bookedServiceMinutes: 60,
        lastAutoAssignedAt: new Date("2026-09-08T10:00:00.000Z"),
      },
    ];

    expect(FairnessSelector.selectBarber(candidates)).toBe("barber-older");
  });

  it("Tier 3: resolves tie using stable lexicographical barberProfileId ordering when minutes and auto-assigned recency are identical", () => {
    const candidates: BarberWorkloadSummary[] = [
      {
        barberProfileId: "018f-barber-z",
        bookedServiceMinutes: 45,
        lastAutoAssignedAt: null,
      },
      {
        barberProfileId: "018f-barber-a",
        bookedServiceMinutes: 45,
        lastAutoAssignedAt: null,
      },
      {
        barberProfileId: "018f-barber-m",
        bookedServiceMinutes: 45,
        lastAutoAssignedAt: null,
      },
    ];

    expect(FairnessSelector.selectBarber(candidates)).toBe("018f-barber-a");
  });

  it("guarantees deterministic result regardless of candidate array input order", () => {
    const c1: BarberWorkloadSummary = {
      barberProfileId: "barber-1",
      bookedServiceMinutes: 30,
      lastAutoAssignedAt: new Date("2026-09-08T10:00:00.000Z"),
    };
    const c2: BarberWorkloadSummary = {
      barberProfileId: "barber-2",
      bookedServiceMinutes: 30,
      lastAutoAssignedAt: new Date("2026-09-08T08:00:00.000Z"), // older timestamp -> winner
    };
    const c3: BarberWorkloadSummary = {
      barberProfileId: "barber-3",
      bookedServiceMinutes: 60,
      lastAutoAssignedAt: null,
    };

    expect(FairnessSelector.selectBarber([c1, c2, c3])).toBe("barber-2");
    expect(FairnessSelector.selectBarber([c3, c2, c1])).toBe("barber-2");
    expect(FairnessSelector.selectBarber([c2, c1, c3])).toBe("barber-2");
  });
});
