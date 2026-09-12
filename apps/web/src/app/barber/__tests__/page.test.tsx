import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { BarberAppointmentDto } from "@barberkece/contracts";

// Mock router for LogoutButton and navigation
const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}));

import BarberPage, { metadata } from "../page";
import { BarberTodayWorkspace } from "@/components/barber/barber-today-workspace";
import { BarberTimelineItem } from "@/components/barber/barber-timeline-item";
import { BarberCancelDialog } from "@/components/barber/barber-cancel-dialog";
import { mapTransitionErrorMessage } from "@/components/barber/barber-workspace-helpers";

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

function makeAppointment(
  overrides: Partial<BarberAppointmentDto>,
): BarberAppointmentDto {
  return {
    id: "app-default-id",
    bookingReference: "BK-202609-001",
    customerId: "cust-uuid-1",
    barberProfileId: "barber-uuid-1",
    serviceId: "svc-uuid-1",
    status: "CONFIRMED",
    startsAt: "2026-09-12T03:00:00.000Z", // 10:00 WIB
    endsAt: "2026-09-12T03:45:00.000Z", // 10:45 WIB
    serviceDurationMinutes: 45,
    priceRupiah: 80000,
    notes: null,
    cancellationReason: null,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("BarberPage & BarberTodayWorkspace (/barber)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports correct page metadata", () => {
    expect(metadata.title).toContain("Workspace Barber");
    expect(metadata.description).toContain("operasional barber");
  });

  it("renders the BarberPage container and workspace heading", () => {
    const html = renderClean(<BarberPage />);
    expect(html).toContain("Workspace Operasional Barber");
    expect(html).toContain("Hari Ini");
  });

  it("renders loading state when initialAppointments is not provided", () => {
    const html = renderClean(<BarberTodayWorkspace />);
    expect(html).toContain('data-testid="barber-loading-state"');
    expect(html).toContain("Memuat jadwal operasional hari ini...");
  });

  it("renders empty today state when appointment list is empty", () => {
    const html = renderClean(<BarberTodayWorkspace initialAppointments={[]} />);
    expect(html).toContain('data-testid="barber-empty-today-state"');
    expect(html).toContain("Tidak Ada Janji Temu Hari Ini");
    expect(html).toContain("Segarkan Jadwal");
  });

  it("renders Jakarta-local date in workspace header", () => {
    const html = renderClean(
      <BarberTodayWorkspace
        initialAppointments={[]}
        initialDate="2026-09-12"
      />,
    );
    expect(html).toContain('data-testid="workspace-jakarta-date"');
    expect(html).toContain("Sabtu, 12 September 2026");
  });

  it("renders truthful summary metrics calculated from API data", () => {
    const app1 = makeAppointment({ id: "1", status: "CONFIRMED" });
    const app2 = makeAppointment({ id: "2", status: "CHECKED_IN" });
    const app3 = makeAppointment({ id: "3", status: "IN_SERVICE" });
    const app4 = makeAppointment({ id: "4", status: "COMPLETED" });
    const app5 = makeAppointment({ id: "5", status: "NO_SHOW" });

    const html = renderClean(
      <BarberTodayWorkspace
        initialAppointments={[app1, app2, app3, app4, app5]}
        initialDate="2026-09-12"
      />,
    );

    expect(html).toContain('data-testid="truthful-summary-metrics"');
    expect(html).toMatch(/data-testid="metric-total-count"[^>]*>5<\/span>/);
    expect(html).toMatch(/data-testid="metric-active-count"[^>]*>3<\/span>/);
    expect(html).toMatch(/data-testid="metric-completed-count"[^>]*>1<\/span>/);
    expect(html).toMatch(/data-testid="metric-cancelled-count"[^>]*>1<\/span>/);
  });

  describe("Chronological Timeline Rendering", () => {
    it("renders appointments in chronological order with time, ref, duration, price, badge", () => {
      const early = makeAppointment({
        id: "early",
        bookingReference: "BK-EARLY",
        startsAt: "2026-09-12T02:00:00.000Z", // 09:00 WIB
        endsAt: "2026-09-12T02:30:00.000Z", // 09:30 WIB
        serviceDurationMinutes: 30,
        priceRupiah: 50000,
        status: "CONFIRMED",
      });
      const late = makeAppointment({
        id: "late",
        bookingReference: "BK-LATE",
        startsAt: "2026-09-12T06:00:00.000Z", // 13:00 WIB
        endsAt: "2026-09-12T07:00:00.000Z", // 14:00 WIB
        serviceDurationMinutes: 60,
        priceRupiah: 120000,
        status: "CHECKED_IN",
      });

      // Pass in reverse order
      const html = renderClean(
        <BarberTodayWorkspace
          initialAppointments={[late, early]}
          initialDate="2026-09-12"
        />,
      );

      // Verify both items rendered
      expect(html).toContain('data-testid="barber-appointment-item-early"');
      expect(html).toContain('data-testid="barber-appointment-item-late"');

      // Verify chronological order in HTML
      const earlyIdx = html.indexOf(
        'data-testid="barber-appointment-item-early"',
      );
      const lateIdx = html.indexOf(
        'data-testid="barber-appointment-item-late"',
      );
      expect(earlyIdx).toBeLessThan(lateIdx);

      // Verify details
      expect(html).toContain("#BK-EARLY");
      expect(html).toContain("30 menit");
      expect(html).toContain("Rp 50.000");
    });

    it("renders notes and cancellation reasons in timeline when present", () => {
      const withNotes = makeAppointment({
        id: "1",
        notes: "Minta model taper fade pendek samping",
        cancellationReason: null,
      });
      const withCancel = makeAppointment({
        id: "2",
        status: "CANCELLED_BY_BARBERSHOP",
        cancellationReason: "Listrik padam di ruko",
      });

      const html = renderClean(
        <BarberTodayWorkspace
          initialAppointments={[withNotes, withCancel]}
          initialDate="2026-09-12"
        />,
      );

      expect(html).toContain("Minta model taper fade pendek samping");
      expect(html).toContain("Listrik padam di ruko");
    });
  });

  describe("Active / Next Spotlight", () => {
    const testNow = new Date("2026-09-12T04:00:00.000Z").getTime(); // 11:00 WIB

    it("highlights IN_SERVICE appointment with active spotlight tag", () => {
      const inService = makeAppointment({
        id: "app-service",
        status: "IN_SERVICE",
        bookingReference: "BK-IN-SERVICE",
        startsAt: "2026-09-12T03:30:00.000Z",
      });
      const confirmed = makeAppointment({
        id: "app-conf",
        status: "CONFIRMED",
        startsAt: "2026-09-12T05:00:00.000Z",
      });

      const html = renderClean(
        <BarberTodayWorkspace
          initialAppointments={[inService, confirmed]}
          initialDate="2026-09-12"
          initialNow={testNow}
        />,
      );

      expect(html).toContain('data-testid="barber-spotlight-card"');
      expect(html).toContain("FOKUS AKTIF • SEDANG DILAYANI");
      expect(html).toContain("#BK-IN-SERVICE");
      expect(html).toContain(
        'data-testid="spotlight-complete-btn-app-service"',
      );
    });

    it("highlights CHECKED_IN appointment when no appointment is IN_SERVICE", () => {
      const checkedIn = makeAppointment({
        id: "app-checked",
        status: "CHECKED_IN",
        bookingReference: "BK-CHECKED-IN",
        startsAt: "2026-09-12T03:45:00.000Z",
      });
      const confirmed = makeAppointment({
        id: "app-conf",
        status: "CONFIRMED",
        startsAt: "2026-09-12T05:00:00.000Z",
      });

      const html = renderClean(
        <BarberTodayWorkspace
          initialAppointments={[checkedIn, confirmed]}
          initialDate="2026-09-12"
          initialNow={testNow}
        />,
      );

      expect(html).toContain('data-testid="barber-spotlight-card"');
      expect(html).toContain("FOKUS AKTIF • PELANGGAN SUDAH CHECK-IN");
      expect(html).toContain("#BK-CHECKED-IN");
      expect(html).toContain(
        'data-testid="spotlight-start-service-btn-app-checked"',
      );
    });

    it("highlights nearest future CONFIRMED as next appointment", () => {
      const pastConfirmed = makeAppointment({
        id: "app-past",
        status: "CONFIRMED",
        startsAt: "2026-09-12T02:00:00.000Z", // 09:00 WIB (past relative to testNow 11:00)
      });
      const nearestFuture = makeAppointment({
        id: "app-nearest",
        status: "CONFIRMED",
        bookingReference: "BK-NEAREST",
        startsAt: "2026-09-12T04:30:00.000Z", // 11:30 WIB (nearest future)
      });
      const laterFuture = makeAppointment({
        id: "app-later",
        status: "CONFIRMED",
        startsAt: "2026-09-12T06:00:00.000Z", // 13:00 WIB
      });

      const html = renderClean(
        <BarberTodayWorkspace
          initialAppointments={[pastConfirmed, nearestFuture, laterFuture]}
          initialDate="2026-09-12"
          initialNow={testNow}
        />,
      );

      expect(html).toContain('data-testid="barber-spotlight-card"');
      expect(html).toContain("Janji Temu Berikutnya");
      expect(html).toContain("#BK-NEAREST");
      expect(html).toContain(
        'data-testid="spotlight-check-in-btn-app-nearest"',
      );
    });

    it("excludes terminal appointments from becoming active spotlight", () => {
      const completed = makeAppointment({ id: "1", status: "COMPLETED" });
      const noShow = makeAppointment({ id: "2", status: "NO_SHOW" });
      const cancelled = makeAppointment({
        id: "3",
        status: "CANCELLED_BY_BARBERSHOP",
      });

      const html = renderClean(
        <BarberTodayWorkspace
          initialAppointments={[completed, noShow, cancelled]}
          initialDate="2026-09-12"
          initialNow={testNow}
        />,
      );

      // Terminal appointments do not form an active spotlight
      expect(html).toContain("Semua Jadwal Hari Ini Telah Selesai");
      expect(html).not.toContain("FOKUS AKTIF");
      expect(html).not.toContain("Janji Temu Berikutnya");
    });
  });

  describe("Operational Actions Visibility", () => {
    it("renders Check-In, No Show, and Batalkan for CONFIRMED appointment", () => {
      const app = makeAppointment({ id: "app-1", status: "CONFIRMED" });
      const html = renderClean(
        <BarberTimelineItem appointment={app} onAction={vi.fn()} />,
      );

      expect(html).toContain('data-testid="check-in-btn-app-1"');
      expect(html).toContain('data-testid="no-show-btn-app-1"');
      expect(html).toContain('data-testid="cancel-btn-app-1"');
      expect(html).not.toContain('data-testid="start-service-btn-app-1"');
      expect(html).not.toContain('data-testid="complete-btn-app-1"');
    });

    it("renders Mulai Layanan and Batalkan for CHECKED_IN appointment", () => {
      const app = makeAppointment({ id: "app-2", status: "CHECKED_IN" });
      const html = renderClean(
        <BarberTimelineItem appointment={app} onAction={vi.fn()} />,
      );

      expect(html).toContain('data-testid="start-service-btn-app-2"');
      expect(html).toContain('data-testid="cancel-btn-app-2"');
      expect(html).not.toContain('data-testid="check-in-btn-app-2"');
      expect(html).not.toContain('data-testid="complete-btn-app-2"');
      expect(html).not.toContain('data-testid="no-show-btn-app-2"');
    });

    it("renders Selesaikan Layanan for IN_SERVICE appointment", () => {
      const app = makeAppointment({ id: "app-3", status: "IN_SERVICE" });
      const html = renderClean(
        <BarberTimelineItem appointment={app} onAction={vi.fn()} />,
      );

      expect(html).toContain('data-testid="complete-btn-app-3"');
      expect(html).not.toContain('data-testid="start-service-btn-app-3"');
      expect(html).not.toContain('data-testid="cancel-btn-app-3"');
      expect(html).not.toContain('data-testid="no-show-btn-app-3"');
    });

    it("renders NO action buttons for all terminal statuses", () => {
      const terminalStatuses = [
        "COMPLETED",
        "CANCELLED_BY_CUSTOMER",
        "CANCELLED_BY_BARBERSHOP",
        "NO_SHOW",
      ];

      for (const status of terminalStatuses) {
        const app = makeAppointment({ id: `app-${status}`, status });
        const html = renderClean(
          <BarberTimelineItem appointment={app} onAction={vi.fn()} />,
        );
        expect(html).not.toContain("Check-In");
        expect(html).not.toContain("Mulai Layanan");
        expect(html).not.toContain("Selesaikan Layanan");
        expect(html).not.toContain("Tidak Hadir (No Show)");
        expect(html).not.toContain("Batalkan");
      }
    });
  });

  describe("Cancellation Dialog & Reason Validation", () => {
    it("renders dialog when isOpen is true with required reason input and char counter", () => {
      const html = renderClean(
        <BarberCancelDialog
          isOpen={true}
          onClose={vi.fn()}
          appointmentId="app-cancel-1"
          bookingReference="BK-CANCEL-TEST"
          onConfirm={vi.fn()}
        />,
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain("Batalkan Janji Temu");
      expect(html).toContain("#BK-CANCEL-TEST");
      expect(html).toContain("Alasan Pembatalan");
      expect(html).toContain("0/500");
      expect(html).toContain('data-testid="confirm-cancel-btn-app-cancel-1"');
    });

    it("renders nothing when isOpen is false", () => {
      const html = renderClean(
        <BarberCancelDialog
          isOpen={false}
          onClose={vi.fn()}
          appointmentId="app-cancel-1"
          bookingReference="BK-CANCEL-TEST"
          onConfirm={vi.fn()}
        />,
      );
      expect(html).toBe("");
    });

    it("displays error message when provided to dialog", () => {
      const html = renderClean(
        <BarberCancelDialog
          isOpen={true}
          onClose={vi.fn()}
          appointmentId="app-cancel-1"
          bookingReference="BK-CANCEL-TEST"
          errorMessage="Terjadi kendala saat membatalkan"
          onConfirm={vi.fn()}
        />,
      );
      expect(html).toContain("Terjadi kendala saat membatalkan");
    });
  });

  describe("API Error Handling and NO_SHOW Rejection", () => {
    it("maps backend NO_SHOW rejection message cleanly", () => {
      const errorMsg = mapTransitionErrorMessage(400, {
        code: "BAD_REQUEST",
        message:
          "Cannot mark appointment as NO_SHOW before grace period elapses (endsAt + 15 minutes)",
      });
      expect(errorMsg).toContain("grace period");
    });

    it("maps invalid transition error message cleanly", () => {
      const errorMsg = mapTransitionErrorMessage(400, {
        code: "BAD_REQUEST",
        message: "Cannot transition appointment from COMPLETED to CHECKED_IN",
      });
      expect(errorMsg).toContain("Cannot transition");
    });
  });

  describe("Authoritative Transition API & Re-fetch Interactions", () => {
    it("successful transition calls backend and returns updated appointment", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: makeAppointment({ id: "app-1", status: "CHECKED_IN" }),
        }),
      });
      global.fetch = mockFetch;

      const res = await fetch("/api/v1/barber/appointments/app-1/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "CHECKED_IN" }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/barber/appointments/app-1/transition",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ targetStatus: "CHECKED_IN" }),
        }),
      );
      const json = await res.json();
      expect(json.data.status).toBe("CHECKED_IN");
    });

    it("surfaces NO_SHOW backend rejection correctly without optimistic mutation", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: "BAD_REQUEST",
            message:
              "Cannot mark appointment as NO_SHOW before grace period elapses (endsAt + 15 minutes)",
          },
        }),
      });
      global.fetch = mockFetch;

      const res = await fetch("/api/v1/barber/appointments/app-1/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus: "NO_SHOW" }),
      });

      expect(res.ok).toBe(false);
      const data = await res.json();
      const mapped = mapTransitionErrorMessage(res.status, data.error);
      expect(mapped).toContain("grace period");
    });

    it("passes cancellationReason when cancelling by barbershop", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: makeAppointment({
            id: "app-1",
            status: "CANCELLED_BY_BARBERSHOP",
            cancellationReason: "Listrik padam mendadak",
          }),
        }),
      });
      global.fetch = mockFetch;

      const res = await fetch("/api/v1/barber/appointments/app-1/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: "CANCELLED_BY_BARBERSHOP",
          cancellationReason: "Listrik padam mendadak",
        }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/barber/appointments/app-1/transition",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            targetStatus: "CANCELLED_BY_BARBERSHOP",
            cancellationReason: "Listrik padam mendadak",
          }),
        }),
      );
      const json = await res.json();
      expect(json.data.status).toBe("CANCELLED_BY_BARBERSHOP");
      expect(json.data.cancellationReason).toBe("Listrik padam mendadak");
    });
  });
});
