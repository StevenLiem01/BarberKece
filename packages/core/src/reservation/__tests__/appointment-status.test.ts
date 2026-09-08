import { describe, it, expect } from "vitest";
import {
  AppointmentStatus,
  ACTIVE_APPOINTMENT_STATUSES,
  isActiveAppointmentStatus,
  canTransitionAppointmentStatus,
  assertValidAppointmentStatusTransition,
} from "../domain/appointment-status.js";
import { InvalidAppointmentStatusTransitionError } from "../errors.js";

describe("AppointmentStatus", () => {
  it("defines exactly the 7 locked canonical statuses", () => {
    const statuses = Object.values(AppointmentStatus);
    expect(statuses).toEqual([
      "CONFIRMED",
      "CHECKED_IN",
      "IN_SERVICE",
      "COMPLETED",
      "CANCELLED_BY_CUSTOMER",
      "CANCELLED_BY_BARBERSHOP",
      "NO_SHOW",
    ]);
  });

  it("identifies active statuses that participate in overlap exclusion", () => {
    expect(ACTIVE_APPOINTMENT_STATUSES).toEqual([
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CHECKED_IN,
      AppointmentStatus.IN_SERVICE,
    ]);

    expect(isActiveAppointmentStatus(AppointmentStatus.CONFIRMED)).toBe(true);
    expect(isActiveAppointmentStatus(AppointmentStatus.CHECKED_IN)).toBe(true);
    expect(isActiveAppointmentStatus(AppointmentStatus.IN_SERVICE)).toBe(true);

    expect(isActiveAppointmentStatus(AppointmentStatus.COMPLETED)).toBe(false);
    expect(
      isActiveAppointmentStatus(AppointmentStatus.CANCELLED_BY_CUSTOMER),
    ).toBe(false);
    expect(
      isActiveAppointmentStatus(AppointmentStatus.CANCELLED_BY_BARBERSHOP),
    ).toBe(false);
    expect(isActiveAppointmentStatus(AppointmentStatus.NO_SHOW)).toBe(false);
  });

  describe("state transitions", () => {
    it("allows valid transitions from CONFIRMED", () => {
      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.CHECKED_IN,
        ),
      ).toBe(true);
      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.CANCELLED_BY_CUSTOMER,
        ),
      ).toBe(true);
      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.CANCELLED_BY_BARBERSHOP,
        ),
      ).toBe(true);
      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.NO_SHOW,
        ),
      ).toBe(true);

      // Disallow skipping to IN_SERVICE or COMPLETED directly
      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.IN_SERVICE,
        ),
      ).toBe(false);
      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.COMPLETED,
        ),
      ).toBe(false);
    });

    it("allows valid transitions from CHECKED_IN", () => {
      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.CHECKED_IN,
          AppointmentStatus.IN_SERVICE,
        ),
      ).toBe(true);
      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.CHECKED_IN,
          AppointmentStatus.CANCELLED_BY_BARBERSHOP,
        ),
      ).toBe(true);

      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.CHECKED_IN,
          AppointmentStatus.CONFIRMED,
        ),
      ).toBe(false);
      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.CHECKED_IN,
          AppointmentStatus.COMPLETED,
        ),
      ).toBe(false);
    });

    it("allows valid transitions from IN_SERVICE", () => {
      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.IN_SERVICE,
          AppointmentStatus.COMPLETED,
        ),
      ).toBe(true);

      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.IN_SERVICE,
          AppointmentStatus.CONFIRMED,
        ),
      ).toBe(false);
      expect(
        canTransitionAppointmentStatus(
          AppointmentStatus.IN_SERVICE,
          AppointmentStatus.CANCELLED_BY_CUSTOMER,
        ),
      ).toBe(false);
    });

    it("treats COMPLETED, CANCELLED, and NO_SHOW as terminal states", () => {
      const terminalStatuses = [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED_BY_CUSTOMER,
        AppointmentStatus.CANCELLED_BY_BARBERSHOP,
        AppointmentStatus.NO_SHOW,
      ];

      for (const terminal of terminalStatuses) {
        for (const target of Object.values(AppointmentStatus)) {
          expect(canTransitionAppointmentStatus(terminal, target)).toBe(false);
        }
      }
    });

    it("assertValidAppointmentStatusTransition throws InvalidAppointmentStatusTransitionError on illegal move", () => {
      expect(() =>
        assertValidAppointmentStatusTransition(
          AppointmentStatus.COMPLETED,
          AppointmentStatus.CONFIRMED,
        ),
      ).toThrow(InvalidAppointmentStatusTransitionError);
    });
  });
});
