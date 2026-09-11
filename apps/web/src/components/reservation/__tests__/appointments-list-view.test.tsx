import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  AppointmentsListView,
  isUpcomingAppointment,
} from "../appointments-list-view";
import { AppointmentCardData } from "../appointment-card";

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

describe("AppointmentsListView & Classification", () => {
  const fixedNow = new Date("2026-09-15T12:00:00.000Z").getTime();

  const futureActiveAppointment: AppointmentCardData = {
    id: "app-future-active",
    bookingReference: "BK-FUTURE-01",
    serviceId: "srv-1",
    serviceName: "Modern Fade",
    status: "CONFIRMED",
    startsAt: "2026-09-16T03:00:00.000Z",
    endsAt: "2026-09-16T03:45:00.000Z",
    priceRupiah: 100000,
  };

  const futureCancelledAppointment: AppointmentCardData = {
    id: "app-future-cancelled",
    bookingReference: "BK-CANCELLED-01",
    serviceId: "srv-1",
    serviceName: "Beard Trim",
    status: "CANCELLED_BY_CUSTOMER",
    startsAt: "2026-09-17T03:00:00.000Z",
    endsAt: "2026-09-17T03:45:00.000Z",
    priceRupiah: 50000,
  };

  const futureCompletedAppointment: AppointmentCardData = {
    id: "app-future-completed",
    bookingReference: "BK-COMPLETED-01",
    serviceId: "srv-1",
    serviceName: "Hair Wash",
    status: "COMPLETED",
    startsAt: "2026-09-18T03:00:00.000Z",
    endsAt: "2026-09-18T03:45:00.000Z",
    priceRupiah: 40000,
  };

  const pastAppointment: AppointmentCardData = {
    id: "app-past",
    bookingReference: "BK-PAST-01",
    serviceId: "srv-1",
    serviceName: "Classic Cut",
    status: "COMPLETED",
    startsAt: "2026-09-10T03:00:00.000Z",
    endsAt: "2026-09-10T03:45:00.000Z",
    priceRupiah: 100000,
  };

  describe("isUpcomingAppointment Classification", () => {
    it("classifies active future appointment as upcoming", () => {
      expect(isUpcomingAppointment(futureActiveAppointment, fixedNow)).toBe(
        true,
      );
    });

    it("does NOT classify cancelled appointment as upcoming even if timestamp is in the future", () => {
      expect(isUpcomingAppointment(futureCancelledAppointment, fixedNow)).toBe(
        false,
      );
    });

    it("does NOT classify completed appointment as upcoming even if timestamp is in the future", () => {
      expect(isUpcomingAppointment(futureCompletedAppointment, fixedNow)).toBe(
        false,
      );
    });

    it("classifies past appointment as history", () => {
      expect(isUpcomingAppointment(pastAppointment, fixedNow)).toBe(false);
    });

    it("classifies CHECKED_IN appointment as upcoming even if scheduled endsAt has passed", () => {
      const pastCheckedIn: AppointmentCardData = {
        ...pastAppointment,
        id: "app-past-checked-in",
        status: "CHECKED_IN",
      };
      expect(isUpcomingAppointment(pastCheckedIn, fixedNow)).toBe(true);
    });

    it("classifies IN_SERVICE appointment as upcoming even if scheduled endsAt has passed", () => {
      const pastInService: AppointmentCardData = {
        ...pastAppointment,
        id: "app-past-in-service",
        status: "IN_SERVICE",
      };
      expect(isUpcomingAppointment(pastInService, fixedNow)).toBe(true);
    });
  });

  describe("Sorting & Determinism", () => {
    it("sorts upcoming appointments nearest first with deterministic id tie-breaker", () => {
      const appA: AppointmentCardData = {
        ...futureActiveAppointment,
        id: "app-b-id",
        bookingReference: "BK-SAME-TIME-B",
        startsAt: "2026-09-16T03:00:00.000Z",
      };
      const appB: AppointmentCardData = {
        ...futureActiveAppointment,
        id: "app-a-id",
        bookingReference: "BK-SAME-TIME-A",
        startsAt: "2026-09-16T03:00:00.000Z",
      };

      const html = renderClean(
        <AppointmentsListView
          appointments={[appA, appB]}
          initialNow={fixedNow}
        />,
      );

      // app-a-id comes before app-b-id alphabetically
      const indexA = html.indexOf("BK-SAME-TIME-A");
      const indexB = html.indexOf("BK-SAME-TIME-B");
      expect(indexA).toBeLessThan(indexB);
    });
  });

  describe("Component Rendering & Accessibility", () => {
    it("renders global empty state when customer has zero appointments", () => {
      const html = renderClean(
        <AppointmentsListView appointments={[]} initialNow={fixedNow} />,
      );

      expect(html).toContain("Belum Ada Reservasi");
      expect(html).toContain("Pesan Sekarang");
      expect(html).toContain('href="/book"');
    });

    it("renders upcoming appointments tab with accurate count", () => {
      const html = renderClean(
        <AppointmentsListView
          appointments={[
            futureActiveAppointment,
            futureCancelledAppointment,
            pastAppointment,
          ]}
          initialNow={fixedNow}
        />,
      );

      expect(html).toContain("Mendatang (1)");
      expect(html).toContain("Riwayat (2)");
      expect(html).toContain("BK-FUTURE-01");
    });

    it("renders empty state in upcoming tab when all appointments belong to history", () => {
      const html = renderClean(
        <AppointmentsListView
          appointments={[pastAppointment, futureCancelledAppointment]}
          initialNow={fixedNow}
        />,
      );

      expect(html).toContain("Mendatang (0)");
      expect(html).toContain("Riwayat (2)");
      expect(html).toContain("Tidak Ada Janji Temu Mendatang");
      expect(html).toContain("Pesan Janji Temu");
    });

    it("renders proper ARIA tablist, tab, and tabpanel semantics with roving tabIndex", () => {
      const html = renderClean(
        <AppointmentsListView
          appointments={[futureActiveAppointment]}
          initialNow={fixedNow}
        />,
      );

      expect(html).toContain('role="tablist"');
      expect(html).toContain('aria-label="Filter Janji Temu"');
      expect(html).toContain('role="tab"');
      expect(html).toContain('id="tab-upcoming"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('aria-controls="panel-upcoming"');

      expect(html).toContain('id="tab-history"');
      expect(html).toContain('aria-selected="false"');
      expect(html).toContain('tabindex="-1"');
      expect(html).toContain('aria-controls="panel-history"');

      expect(html).toContain('role="tabpanel"');
      expect(html).toContain('id="panel-upcoming"');
      expect(html).toContain('aria-labelledby="tab-upcoming"');
    });
  });
});
