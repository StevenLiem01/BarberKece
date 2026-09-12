import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { BarberAppointmentDto } from "@barberkece/contracts";
import BarberAppointmentDetailPage, { metadata } from "../page";
import { BarberAppointmentDetail } from "@/components/barber/barber-appointment-detail";
import {
  getAllowedTargetStatuses,
  mapTransitionErrorMessage,
} from "@/components/barber/barber-workspace-helpers";

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

function makeAppointment(
  overrides: Partial<BarberAppointmentDto>,
): BarberAppointmentDto {
  return {
    id: "app-detail-uuid-1",
    bookingReference: "BK-202609-888",
    customerId: "cust-uuid-1",
    barberProfileId: "barber-uuid-1",
    serviceId: "svc-uuid-1",
    status: "CONFIRMED",
    startsAt: "2026-09-12T03:00:00.000Z", // 10:00 WIB
    endsAt: "2026-09-12T03:45:00.000Z", // 10:45 WIB
    serviceDurationMinutes: 45,
    priceRupiah: 85000,
    notes: null,
    cancellationReason: null,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("BarberAppointmentDetailPage & BarberAppointmentDetail (/barber/appointments/[id])", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports correct page metadata", () => {
    expect(metadata.title).toContain("Detail Janji Temu Barber");
    expect(metadata.description).toContain("tindakan operasional");
  });

  it("renders the BarberAppointmentDetailPage async server component", async () => {
    const pageElement = await BarberAppointmentDetailPage({
      params: Promise.resolve({ id: "app-detail-uuid-1" }),
    });
    const html = renderClean(pageElement);
    expect(html).toContain('data-testid="detail-loading-state"');
  });

  it("renders loading skeleton state when appointment is not loaded yet", () => {
    const html = renderClean(
      <BarberAppointmentDetail appointmentId="app-uuid-1" />,
    );
    expect(html).toContain('data-testid="detail-loading-state"');
    expect(html).toContain('aria-label="Memuat detail janji temu..."');
  });

  it("renders IDOR-safe generic not-found message for 404/foreign appointments", () => {
    const html = renderClean(
      <BarberAppointmentDetail
        appointmentId="app-foreign-id"
        initialNotFound={true}
      />,
    );
    expect(html).toContain('data-testid="detail-not-found"');
    expect(html).toContain("Janji Temu Tidak Ditemukan");
    expect(html).toContain("Janji temu tidak ditemukan.");
    // Strict requirement: Do not distinguish ownership/access in the user-facing message
    expect(html).not.toContain("milik barber lain");
    expect(html).not.toContain("bukan milik");
    expect(html).not.toContain("tidak memiliki akses");
    expect(html).toContain("Kembali ke Daftar Janji Temu");
  });

  it("renders error state with retry button when initialError is provided", () => {
    const html = renderClean(
      <BarberAppointmentDetail
        appointmentId="app-err-id"
        initialError="Gagal terhubung ke database."
      />,
    );
    expect(html).toContain('data-testid="detail-error-banner"');
    expect(html).toContain("Gagal Memuat Detail");
    expect(html).toContain("Gagal terhubung ke database.");
    expect(html).toContain('data-testid="detail-retry-btn"');
  });

  it("renders successful owned appointment detail with truthful DTO data", () => {
    const app = makeAppointment({
      id: "app-success-1",
      bookingReference: "BK-CONF-001",
      serviceDurationMinutes: 45,
      priceRupiah: 90000,
      notes: "Klien request styling pomade",
      cancellationReason: null,
    });

    const html = renderClean(
      <BarberAppointmentDetail
        appointmentId="app-success-1"
        initialAppointment={app}
      />,
    );

    expect(html).toContain("Detail Janji Temu");
    expect(html).toContain('data-testid="detail-booking-reference"');
    expect(html).toContain("#BK-CONF-001");
    expect(html).toContain('data-testid="detail-date"');
    expect(html).toContain("Sabtu, 12 September 2026");
    expect(html).toContain('data-testid="detail-time"');
    expect(html).toContain("10.00 - 10.45 WIB");
    expect(html).toContain('data-testid="detail-duration"');
    expect(html).toContain("45 menit");
    expect(html).toContain('data-testid="detail-price"');
    expect(html).toMatch(/Rp[\s\u00a0]?90\.000/);
    expect(html).toContain('data-testid="detail-notes"');
    expect(html).toContain("Klien request styling pomade");

    // Must not fabricate customer/service human names from raw IDs
    expect(html).not.toContain("cust-uuid-1");
    expect(html).not.toContain("svc-uuid-1");
  });

  it("renders operational actions for CONFIRMED status: Check-In, No Show, Cancel", () => {
    const app = makeAppointment({
      id: "app-conf-1",
      status: "CONFIRMED",
    });

    const allowed = getAllowedTargetStatuses("CONFIRMED");
    expect(allowed).toEqual([
      "CHECKED_IN",
      "NO_SHOW",
      "CANCELLED_BY_BARBERSHOP",
    ]);

    const html = renderClean(
      <BarberAppointmentDetail
        appointmentId="app-conf-1"
        initialAppointment={app}
      />,
    );

    expect(html).toContain('data-testid="detail-check-in-btn"');
    expect(html).toContain("Check-In");
    expect(html).toContain('data-testid="detail-no-show-btn"');
    expect(html).toContain("Tidak Hadir (No Show)");
    expect(html).toContain('data-testid="detail-cancel-btn"');
    expect(html).toContain("Batalkan Janji Temu");

    // Complete / Start should NOT be present
    expect(html).not.toContain('data-testid="detail-start-service-btn"');
    expect(html).not.toContain('data-testid="detail-complete-btn"');
  });

  it("renders operational actions for CHECKED_IN status: Start Service, Cancel", () => {
    const app = makeAppointment({
      id: "app-check-1",
      status: "CHECKED_IN",
    });

    const allowed = getAllowedTargetStatuses("CHECKED_IN");
    expect(allowed).toEqual(["IN_SERVICE", "CANCELLED_BY_BARBERSHOP"]);

    const html = renderClean(
      <BarberAppointmentDetail
        appointmentId="app-check-1"
        initialAppointment={app}
      />,
    );

    expect(html).toContain('data-testid="detail-start-service-btn"');
    expect(html).toContain("Mulai Layanan");
    expect(html).toContain('data-testid="detail-cancel-btn"');
    expect(html).toContain("Batalkan Janji Temu");

    // Check-in / Complete / No Show should NOT be present
    expect(html).not.toContain('data-testid="detail-check-in-btn"');
    expect(html).not.toContain('data-testid="detail-complete-btn"');
    expect(html).not.toContain('data-testid="detail-no-show-btn"');
  });

  it("renders operational actions for IN_SERVICE status: Complete only", () => {
    const app = makeAppointment({
      id: "app-srv-1",
      status: "IN_SERVICE",
    });

    const allowed = getAllowedTargetStatuses("IN_SERVICE");
    expect(allowed).toEqual(["COMPLETED"]);

    const html = renderClean(
      <BarberAppointmentDetail
        appointmentId="app-srv-1"
        initialAppointment={app}
      />,
    );

    expect(html).toContain('data-testid="detail-complete-btn"');
    expect(html).toContain("Selesaikan Layanan");

    // Cancel / Check-in / Start should NOT be present
    expect(html).not.toContain('data-testid="detail-cancel-btn"');
    expect(html).not.toContain('data-testid="detail-check-in-btn"');
    expect(html).not.toContain('data-testid="detail-start-service-btn"');
  });

  it("renders terminal notice and NO operational mutation buttons for terminal statuses", () => {
    const terminalStatuses = [
      "COMPLETED",
      "CANCELLED_BY_CUSTOMER",
      "CANCELLED_BY_BARBERSHOP",
      "NO_SHOW",
    ];

    terminalStatuses.forEach((status) => {
      const allowed = getAllowedTargetStatuses(status);
      expect(allowed).toEqual([]);

      const app = makeAppointment({
        id: `app-${status}`,
        status,
        cancellationReason: status.startsWith("CANCELLED")
          ? "Pembatalan tercatat"
          : null,
      });

      const html = renderClean(
        <BarberAppointmentDetail
          appointmentId={`app-${status}`}
          initialAppointment={app}
        />,
      );

      expect(html).toContain('data-testid="detail-terminal-notice"');
      expect(html).toContain(
        `Janji temu ini telah berstatus terminal (${status})`,
      );
      expect(html).not.toContain('data-testid="detail-check-in-btn"');
      expect(html).not.toContain('data-testid="detail-start-service-btn"');
      expect(html).not.toContain('data-testid="detail-complete-btn"');
      expect(html).not.toContain('data-testid="detail-no-show-btn"');
      expect(html).not.toContain('data-testid="detail-cancel-btn"');
    });
  });

  it("maps transition error messages truthfully for 400 NO_SHOW grace period and cancellation reason", () => {
    // Grace period rejection
    const graceMsg = mapTransitionErrorMessage(400, {
      message: "No show grace period not elapsed (minimum 15 minutes)",
    });
    expect(graceMsg).toContain("grace period");

    // Cancellation reason required
    const reasonMsg = mapTransitionErrorMessage(400, {
      message: "cancellation reason required",
    });
    expect(reasonMsg).toContain("Alasan pembatalan wajib diisi");

    // Generic 404
    const notFoundMsg = mapTransitionErrorMessage(404);
    expect(notFoundMsg).toContain("Janji temu tidak ditemukan");

    // Session 401
    const authMsg = mapTransitionErrorMessage(401);
    expect(authMsg).toContain("Sesi Anda telah berakhir");
  });
});
