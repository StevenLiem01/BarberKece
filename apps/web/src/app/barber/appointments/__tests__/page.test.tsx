import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { BarberAppointmentDto } from "@barberkece/contracts";
import BarberAppointmentsPage, { metadata } from "../page";
import {
  BarberAppointmentsHub,
  CANONICAL_STATUSES,
} from "@/components/barber/barber-appointments-hub";
import {
  jakartaDayStartToIso,
  jakartaDayEndToIso,
} from "@/components/barber/barber-workspace-helpers";

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

describe("BarberAppointmentsPage & BarberAppointmentsHub (/barber/appointments)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports correct page metadata", () => {
    expect(metadata.title).toContain("Daftar Janji Temu Barber");
    expect(metadata.description).toContain("jadwal lengkap janji temu");
  });

  it("renders the BarberAppointmentsPage container and hub heading", () => {
    const html = renderClean(<BarberAppointmentsPage />);
    expect(html).toContain("Daftar Janji Temu");
    expect(html).toContain("Operasional Barber");
    expect(html).toContain("Workspace Hari Ini");
  });

  it("renders loading state when initial data is not provided", () => {
    const html = renderClean(<BarberAppointmentsHub />);
    expect(html).toContain('data-testid="hub-loading-state"');
    expect(html).toContain('aria-label="Memuat daftar janji temu..."');
  });

  it("renders error state with retry button when initialError is provided", () => {
    const html = renderClean(
      <BarberAppointmentsHub initialError="Koneksi jaringan terputus." />,
    );
    expect(html).toContain('data-testid="hub-error-banner"');
    expect(html).toContain("Gagal Memuat Janji Temu");
    expect(html).toContain("Koneksi jaringan terputus.");
    expect(html).toContain('data-testid="hub-retry-btn"');
  });

  it("renders empty state when appointment list is empty", () => {
    const html = renderClean(
      <BarberAppointmentsHub initialAppointments={[]} />,
    );
    expect(html).toContain('data-testid="hub-empty-state"');
    expect(html).toContain("Tidak Ada Janji Temu Ditemukan");
    expect(html).toContain(
      "Belum ada janji temu yang tercatat di akun barber Anda.",
    );
  });

  it("renders empty state with filter reset prompt when filtered list is empty", () => {
    const html = renderClean(
      <BarberAppointmentsHub
        initialAppointments={[]}
        initialStatusFilter="COMPLETED"
      />,
    );
    expect(html).toContain('data-testid="hub-empty-state"');
    expect(html).toContain("Tidak ada janji temu yang cocok dengan filter");
    expect(html).toContain("Reset Semua Filter");
    expect(html).toContain('data-testid="reset-filters-btn"');
  });

  it("renders appointments in chronological order with date, time, reference, duration, price", () => {
    const early = makeAppointment({
      id: "early-id",
      bookingReference: "BK-EARLY-01",
      startsAt: "2026-09-12T02:00:00.000Z", // 09:00 WIB
      endsAt: "2026-09-12T02:45:00.000Z", // 09:45 WIB
      serviceDurationMinutes: 45,
      priceRupiah: 75000,
      status: "CONFIRMED",
    });
    const late = makeAppointment({
      id: "late-id",
      bookingReference: "BK-LATE-02",
      startsAt: "2026-09-12T07:00:00.000Z", // 14:00 WIB
      endsAt: "2026-09-12T08:00:00.000Z", // 15:00 WIB
      serviceDurationMinutes: 60,
      priceRupiah: 100000,
      status: "CHECKED_IN",
    });

    // Provide reverse order
    const html = renderClean(
      <BarberAppointmentsHub initialAppointments={[late, early]} />,
    );

    expect(html).toContain('data-testid="hub-appointment-item-early-id"');
    expect(html).toContain('data-testid="hub-appointment-item-late-id"');

    // Chronological order verification (early appears before late)
    const earlyIdx = html.indexOf("BK-EARLY-01");
    const lateIdx = html.indexOf("BK-LATE-02");
    expect(earlyIdx).toBeLessThan(lateIdx);

    // Time and date in Asia/Jakarta
    expect(html).toContain("09.00 - 09.45 WIB");
    expect(html).toContain("14.00 - 15.00 WIB");
    expect(html).toContain("Sabtu, 12 September 2026");

    // Price snapshot
    expect(html).toMatch(/Rp[\s\u00a0]?75\.000/);
    expect(html).toMatch(/Rp[\s\u00a0]?100\.000/);
  });

  it("renders status badges truthfully for all canonical statuses", () => {
    const statuses = [
      "CONFIRMED",
      "CHECKED_IN",
      "IN_SERVICE",
      "COMPLETED",
      "CANCELLED_BY_CUSTOMER",
      "CANCELLED_BY_BARBERSHOP",
      "NO_SHOW",
    ];

    const apps = statuses.map((status, i) =>
      makeAppointment({
        id: `app-${i}`,
        bookingReference: `BK-REF-${i}`,
        status,
      }),
    );

    const html = renderClean(
      <BarberAppointmentsHub initialAppointments={apps} />,
    );

    expect(html).toContain("Dikonfirmasi");
    expect(html).toContain("Check-In");
    expect(html).toContain("Sedang Layanan");
    expect(html).toContain("Selesai");
    expect(html).toContain("Batal (Pelanggan)");
    expect(html).toContain("Batal (Barbershop)");
    expect(html).toContain("Tidak Hadir");
  });

  it("renders detail links with appointment UUID", () => {
    const app = makeAppointment({
      id: "uuid-abc-123",
      bookingReference: "BK-ABC",
    });

    const html = renderClean(
      <BarberAppointmentsHub initialAppointments={[app]} />,
    );

    expect(html).toContain('href="/barber/appointments/uuid-abc-123"');
    expect(html).toContain('data-testid="view-detail-link-uuid-abc-123"');
  });

  it("does not fabricate human names for customer or service from IDs", () => {
    const app = makeAppointment({
      id: "uuid-truthful",
      customerId: "user-cust-99",
      serviceId: "srv-99",
    });

    const html = renderClean(
      <BarberAppointmentsHub initialAppointments={[app]} />,
    );

    // Raw UUIDs are not displayed as fake names
    expect(html).not.toContain("user-cust-99");
    expect(html).not.toContain("srv-99");
    // Truthful snapshot duration & price are displayed
    expect(html).toContain("45 menit");
    expect(html).toMatch(/Rp[\s\u00a0]?80\.000/);
  });

  it("renders notes and cancellation reasons when present", () => {
    const withNotes = makeAppointment({
      id: "app-notes",
      bookingReference: "BK-NOTES",
      notes: "Klien minta fade tipis di belakang",
      cancellationReason: null,
    });
    const withCancel = makeAppointment({
      id: "app-cancel",
      bookingReference: "BK-CANCEL",
      status: "CANCELLED_BY_BARBERSHOP",
      cancellationReason: "Listrik padam mendadak",
    });

    const html = renderClean(
      <BarberAppointmentsHub initialAppointments={[withNotes, withCancel]} />,
    );

    expect(html).toContain("Catatan: Klien minta fade tipis di belakang");
    expect(html).toContain("Batal: Listrik padam mendadak");
  });

  it("renders filter controls with all canonical status options", () => {
    const html = renderClean(
      <BarberAppointmentsHub initialAppointments={[]} />,
    );

    expect(html).toContain('data-testid="status-filter-select"');
    expect(html).toContain('data-testid="date-mode-select"');

    CANONICAL_STATUSES.forEach((s) => {
      expect(html).toContain(`value="${s.value}"`);
      expect(html).toContain(s.label);
    });
  });

  it("renders single date input when dateMode is SINGLE", () => {
    const html = renderClean(
      <BarberAppointmentsHub
        initialAppointments={[]}
        initialDateMode="SINGLE"
        initialSingleDate="2026-09-12"
      />,
    );

    expect(html).toContain('data-testid="single-date-input"');
    expect(html).toContain('value="2026-09-12"');
  });

  it("renders date range inputs when dateMode is RANGE", () => {
    const html = renderClean(
      <BarberAppointmentsHub
        initialAppointments={[]}
        initialDateMode="RANGE"
        initialFromDate="2026-09-12"
        initialToDate="2026-09-15"
      />,
    );

    expect(html).toContain('data-testid="from-date-input"');
    expect(html).toContain('data-testid="to-date-input"');
    expect(html).toContain('value="2026-09-12"');
    expect(html).toContain('value="2026-09-15"');
  });

  it("correctly converts date range to Asia/Jakarta calendar day boundaries in UTC ISO", () => {
    const startIso = jakartaDayStartToIso("2026-09-12");
    const endIso = jakartaDayEndToIso("2026-09-12");

    // 2026-09-12 00:00:00 WIB is 2026-09-11 17:00:00.000Z
    expect(startIso).toBe("2026-09-11T17:00:00.000Z");
    // 2026-09-13 00:00:00.000 WIB (exclusive next-day boundary) is 2026-09-12 17:00:00.000Z
    expect(endIso).toBe("2026-09-12T17:00:00.000Z");

    // start < end
    expect(new Date(startIso).getTime()).toBeLessThan(
      new Date(endIso).getTime(),
    );

    // Range semantics: startsAt >= from AND startsAt < to
    const lateAppointmentMs = new Date("2026-09-12T16:59:59.999Z").getTime();
    expect(lateAppointmentMs).toBeGreaterThanOrEqual(
      new Date(startIso).getTime(),
    );
    expect(lateAppointmentMs).toBeLessThan(new Date(endIso).getTime());
  });

  it("shows results count truthfully", () => {
    const app1 = makeAppointment({ id: "1" });
    const app2 = makeAppointment({ id: "2" });

    const html = renderClean(
      <BarberAppointmentsHub initialAppointments={[app1, app2]} />,
    );

    expect(html).toContain('data-testid="results-count"');
    expect(html).toContain("Menampilkan");
    expect(html).toContain("2");
    expect(html).toContain("janji temu");
  });
});
