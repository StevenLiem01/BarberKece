import { describe, it, expect } from "vitest";
import { BarberAppointmentDto } from "@barberkece/contracts";
import {
  getJakartaTodayDateString,
  formatJakartaDateIndonesian,
  sortAppointmentsChronologically,
  isTerminalStatus,
  deriveSpotlightAppointment,
  getAllowedOperationalActions,
  getAllowedTargetStatuses,
  jakartaDayStartToIso,
  jakartaDayEndToIso,
  mapTransitionErrorMessage,
} from "../barber-workspace-helpers";

function makeAppointment(
  overrides: Partial<BarberAppointmentDto>,
): BarberAppointmentDto {
  return {
    id: "app-1",
    bookingReference: "BK-001",
    customerId: "cust-1",
    barberProfileId: "barber-1",
    serviceId: "svc-1",
    status: "CONFIRMED",
    startsAt: "2026-09-12T03:00:00.000Z", // 10:00 WIB
    endsAt: "2026-09-12T03:45:00.000Z", // 10:45 WIB
    serviceDurationMinutes: 45,
    priceRupiah: 75000,
    notes: null,
    cancellationReason: null,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("barber-workspace-helpers", () => {
  describe("getJakartaTodayDateString", () => {
    it("returns correct YYYY-MM-DD for Asia/Jakarta timezone", () => {
      // 2026-09-12 01:00 UTC is 2026-09-12 08:00 WIB (Jakarta)
      const date = new Date("2026-09-12T01:00:00.000Z");
      expect(getJakartaTodayDateString(date)).toBe("2026-09-12");
    });

    it("handles day crossover: 2026-09-11 20:00 UTC is 2026-09-12 03:00 WIB", () => {
      const date = new Date("2026-09-11T20:00:00.000Z");
      expect(getJakartaTodayDateString(date)).toBe("2026-09-12");
    });
  });

  describe("formatJakartaDateIndonesian", () => {
    it("formats YYYY-MM-DD into Indonesian localized weekday, date, month, year", () => {
      const formatted = formatJakartaDateIndonesian("2026-09-12");
      expect(formatted).toBe("Sabtu, 12 September 2026");
    });

    it("returns original string on invalid format", () => {
      expect(formatJakartaDateIndonesian("invalid")).toBe("invalid");
    });
  });

  describe("sortAppointmentsChronologically", () => {
    it("sorts by startsAt ascending, then bookingReference as tie-break", () => {
      const a1 = makeAppointment({
        id: "1",
        bookingReference: "BK-002",
        startsAt: "2026-09-12T05:00:00.000Z",
      });
      const a2 = makeAppointment({
        id: "2",
        bookingReference: "BK-001",
        startsAt: "2026-09-12T03:00:00.000Z",
      });
      const a3 = makeAppointment({
        id: "3",
        bookingReference: "BK-003",
        startsAt: "2026-09-12T03:00:00.000Z",
      });

      const sorted = sortAppointmentsChronologically([a1, a2, a3]);
      expect(sorted.map((a) => a.bookingReference)).toEqual([
        "BK-001",
        "BK-003",
        "BK-002",
      ]);
    });
  });

  describe("isTerminalStatus", () => {
    it("identifies COMPLETED, CANCELLED_*, NO_SHOW as terminal", () => {
      expect(isTerminalStatus("COMPLETED")).toBe(true);
      expect(isTerminalStatus("CANCELLED_BY_CUSTOMER")).toBe(true);
      expect(isTerminalStatus("CANCELLED_BY_BARBERSHOP")).toBe(true);
      expect(isTerminalStatus("NO_SHOW")).toBe(true);
    });

    it("identifies CONFIRMED, CHECKED_IN, IN_SERVICE as non-terminal", () => {
      expect(isTerminalStatus("CONFIRMED")).toBe(false);
      expect(isTerminalStatus("CHECKED_IN")).toBe(false);
      expect(isTerminalStatus("IN_SERVICE")).toBe(false);
    });
  });

  describe("deriveSpotlightAppointment", () => {
    const baseNow = new Date("2026-09-12T03:30:00.000Z").getTime(); // 10:30 WIB

    it("prioritizes IN_SERVICE above everything else", () => {
      const app1 = makeAppointment({
        id: "1",
        status: "CHECKED_IN",
        startsAt: "2026-09-12T03:00:00.000Z",
      });
      const app2 = makeAppointment({
        id: "2",
        status: "IN_SERVICE",
        startsAt: "2026-09-12T03:30:00.000Z",
      });
      const app3 = makeAppointment({
        id: "3",
        status: "CONFIRMED",
        startsAt: "2026-09-12T04:15:00.000Z",
      });

      const result = deriveSpotlightAppointment([app1, app2, app3], baseNow);
      expect(result.type).toBe("IN_SERVICE");
      expect(result.appointment?.id).toBe("2");
    });

    it("prioritizes CHECKED_IN when no appointment is IN_SERVICE", () => {
      const app1 = makeAppointment({
        id: "1",
        status: "CONFIRMED",
        startsAt: "2026-09-12T04:00:00.000Z",
      });
      const app2 = makeAppointment({
        id: "2",
        status: "CHECKED_IN",
        startsAt: "2026-09-12T03:00:00.000Z",
      });

      const result = deriveSpotlightAppointment([app1, app2], baseNow);
      expect(result.type).toBe("CHECKED_IN");
      expect(result.appointment?.id).toBe("2");
    });

    it("selects nearest future CONFIRMED when none in service or checked in", () => {
      const app1 = makeAppointment({
        id: "1",
        status: "CONFIRMED",
        startsAt: "2026-09-12T02:00:00.000Z", // 09:00 WIB (past)
      });
      const app2 = makeAppointment({
        id: "2",
        status: "CONFIRMED",
        startsAt: "2026-09-12T04:00:00.000Z", // 11:00 WIB (nearest future)
      });
      const app3 = makeAppointment({
        id: "3",
        status: "CONFIRMED",
        startsAt: "2026-09-12T05:00:00.000Z", // 12:00 WIB (later future)
      });

      const result = deriveSpotlightAppointment([app1, app2, app3], baseNow);
      expect(result.type).toBe("CONFIRMED_NEXT");
      expect(result.appointment?.id).toBe("2");
    });

    it("falls back to earliest pending CONFIRMED if all CONFIRMED are before now", () => {
      const app1 = makeAppointment({
        id: "1",
        status: "CONFIRMED",
        startsAt: "2026-09-12T02:00:00.000Z", // 09:00 WIB
      });
      const app2 = makeAppointment({
        id: "2",
        status: "CONFIRMED",
        startsAt: "2026-09-12T02:45:00.000Z", // 09:45 WIB
      });

      // Now is 10:30 WIB
      const result = deriveSpotlightAppointment([app1, app2], baseNow);
      expect(result.type).toBe("CONFIRMED_OVERDUE");
      expect(result.appointment?.id).toBe("1");
    });

    it("excludes terminal appointments from becoming active spotlight", () => {
      const app1 = makeAppointment({ id: "1", status: "COMPLETED" });
      const app2 = makeAppointment({
        id: "2",
        status: "CANCELLED_BY_CUSTOMER",
      });
      const app3 = makeAppointment({
        id: "3",
        status: "CANCELLED_BY_BARBERSHOP",
      });
      const app4 = makeAppointment({ id: "4", status: "NO_SHOW" });

      const result = deriveSpotlightAppointment(
        [app1, app2, app3, app4],
        baseNow,
      );
      expect(result.appointment).toBeNull();
      expect(result.type).toBeNull();
    });

    it("returns null when appointment list is empty", () => {
      const result = deriveSpotlightAppointment([], baseNow);
      expect(result.appointment).toBeNull();
      expect(result.type).toBeNull();
    });
  });

  describe("getAllowedOperationalActions", () => {
    it("returns CHECK_IN, NO_SHOW, CANCEL for CONFIRMED", () => {
      expect(getAllowedOperationalActions("CONFIRMED")).toEqual([
        "CHECK_IN",
        "NO_SHOW",
        "CANCEL",
      ]);
    });

    it("returns START_SERVICE, CANCEL for CHECKED_IN", () => {
      expect(getAllowedOperationalActions("CHECKED_IN")).toEqual([
        "START_SERVICE",
        "CANCEL",
      ]);
    });

    it("returns COMPLETE for IN_SERVICE", () => {
      expect(getAllowedOperationalActions("IN_SERVICE")).toEqual(["COMPLETE"]);
    });

    it("returns empty array for terminal statuses", () => {
      expect(getAllowedOperationalActions("COMPLETED")).toEqual([]);
      expect(getAllowedOperationalActions("CANCELLED_BY_CUSTOMER")).toEqual([]);
      expect(getAllowedOperationalActions("CANCELLED_BY_BARBERSHOP")).toEqual(
        [],
      );
      expect(getAllowedOperationalActions("NO_SHOW")).toEqual([]);
    });
  });

  describe("mapTransitionErrorMessage", () => {
    it("maps 401/403 to session expired message", () => {
      expect(mapTransitionErrorMessage(401)).toContain(
        "Sesi Anda telah berakhir",
      );
      expect(mapTransitionErrorMessage(403)).toContain(
        "Sesi Anda telah berakhir",
      );
    });

    it("maps 404 to not found message", () => {
      expect(mapTransitionErrorMessage(404)).toContain("tidak ditemukan");
    });

    it("maps NO_SHOW grace period error appropriately", () => {
      const msg = mapTransitionErrorMessage(400, {
        code: "BAD_REQUEST",
        message:
          "Cannot mark appointment as NO_SHOW before grace period elapses (endsAt + 15 minutes)",
      });
      expect(msg).toContain("grace period");
    });

    it("maps cancellation reason required error", () => {
      const msg = mapTransitionErrorMessage(400, {
        code: "BAD_REQUEST",
        message:
          "Cancellation reason is required when barbershop cancels an appointment",
      });
      expect(msg).toContain("Alasan pembatalan wajib diisi");
    });
  });

  describe("getAllowedTargetStatuses", () => {
    it("returns correct target statuses for CONFIRMED", () => {
      expect(getAllowedTargetStatuses("CONFIRMED")).toEqual([
        "CHECKED_IN",
        "NO_SHOW",
        "CANCELLED_BY_BARBERSHOP",
      ]);
    });

    it("returns correct target statuses for CHECKED_IN", () => {
      expect(getAllowedTargetStatuses("CHECKED_IN")).toEqual([
        "IN_SERVICE",
        "CANCELLED_BY_BARBERSHOP",
      ]);
    });

    it("returns correct target statuses for IN_SERVICE", () => {
      expect(getAllowedTargetStatuses("IN_SERVICE")).toEqual(["COMPLETED"]);
    });

    it("returns empty array for terminal statuses", () => {
      expect(getAllowedTargetStatuses("COMPLETED")).toEqual([]);
      expect(getAllowedTargetStatuses("CANCELLED_BY_CUSTOMER")).toEqual([]);
      expect(getAllowedTargetStatuses("CANCELLED_BY_BARBERSHOP")).toEqual([]);
      expect(getAllowedTargetStatuses("NO_SHOW")).toEqual([]);
      expect(getAllowedTargetStatuses("UNKNOWN")).toEqual([]);
    });
  });

  describe("jakartaDayStartToIso and jakartaDayEndToIso", () => {
    it("converts YYYY-MM-DD to exact Asia/Jakarta calendar day boundaries in UTC ISO", () => {
      const start = jakartaDayStartToIso("2026-09-12");
      const end = jakartaDayEndToIso("2026-09-12");

      expect(start).toBe("2026-09-11T17:00:00.000Z");
      expect(end).toBe("2026-09-12T16:59:59.999Z");
    });

    it("returns empty string for invalid date format", () => {
      expect(jakartaDayStartToIso("invalid")).toBe("");
      expect(jakartaDayEndToIso("invalid")).toBe("");
    });
  });
});
