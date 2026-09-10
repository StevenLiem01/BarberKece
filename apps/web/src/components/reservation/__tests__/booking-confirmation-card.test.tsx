import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  BookingConfirmationCard,
  BookingConfirmationAppointment,
} from "../booking-confirmation-card";
import * as calendarModule from "@/lib/calendar";

// Strip React SSR comments
function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

describe("BookingConfirmationCard Component", () => {
  const mockAppointment: BookingConfirmationAppointment = {
    id: "11111111-1111-4111-8111-111111111111",
    bookingReference: "BK-20260915-042",
    status: "CONFIRMED",
    startsAt: "2026-09-15T03:00:00.000Z", // 10.00 WIB
    endsAt: "2026-09-15T03:45:00.000Z", // 10.45 WIB
    serviceDurationMinutes: 45,
    priceRupiah: 120000,
    notes: "Mohon fade rapi samping tipis",
    isAutoAssigned: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders success state and prominent booking reference", () => {
    const html = renderClean(
      <BookingConfirmationCard
        appointment={mockAppointment}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization="Master Barber"
      />,
    );

    expect(html).toContain("Reservasi Berhasil");
    expect(html).toContain("Kode Reservasi");
    expect(html).toContain("BK-20260915-042");
  });

  it("renders service, duration, barber specialization, and auto-assigned badge", () => {
    const html = renderClean(
      <BookingConfirmationCard
        appointment={mockAppointment}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization="Senior Stylist"
      />,
    );

    expect(html).toContain("Gentlemen Classic Cut");
    expect(html).toContain("45 menit");
    expect(html).toContain("Senior Stylist");
    expect(html).toContain("Ditugaskan Otomatis");
  });

  it("renders Indonesian formatted date and WIB time", () => {
    const html = renderClean(
      <BookingConfirmationCard
        appointment={mockAppointment}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization="Senior Stylist"
      />,
    );

    expect(html).toContain("Selasa, 15 September 2026");
    expect(html).toContain("10.00 - 10.45 WIB");
  });

  it("renders total price in Rupiah and optional notes", () => {
    const html = renderClean(
      <BookingConfirmationCard
        appointment={mockAppointment}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization="Senior Stylist"
      />,
    );

    expect(html).toContain("Rp 120.000");
    expect(html).toContain("Mohon fade rapi samping tipis");
  });

  it("omits notes section when appointment.notes is null", () => {
    const withoutNotes: BookingConfirmationAppointment = {
      ...mockAppointment,
      notes: null,
      isAutoAssigned: false,
    };

    const html = renderClean(
      <BookingConfirmationCard
        appointment={withoutNotes}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization="Senior Stylist"
      />,
    );

    expect(html).not.toContain("Catatan");
    expect(html).not.toContain("Ditugaskan Otomatis");
  });

  it("renders appointment detail link pointing to owned appointment ID", () => {
    const html = renderClean(
      <BookingConfirmationCard
        appointment={mockAppointment}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization="Senior Stylist"
      />,
    );

    expect(html).toContain(
      `href="/account/appointments/${mockAppointment.id}"`,
    );
    expect(html).toContain("Lihat Detail Janji Temu");
  });

  it("renders Add to Calendar button and correctly generates ICS file input", () => {
    const html = renderClean(
      <BookingConfirmationCard
        appointment={mockAppointment}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization="Master Barber"
      />,
    );

    expect(html).toContain("Tambah ke Kalender (.ics)");

    const input = calendarModule.generateIcsContent({
      bookingReference: mockAppointment.bookingReference,
      serviceName: "Gentlemen Classic Cut",
      barberName: "Master Barber",
      startsAt: mockAppointment.startsAt,
      endsAt: mockAppointment.endsAt,
      notes: mockAppointment.notes,
    });

    expect(input).toContain("BEGIN:VCALENDAR");
    expect(input).toContain("BK-20260915-042");
    expect(input).toContain("Gentlemen Classic Cut");
    expect(input).toContain("Master Barber");
    expect(input).toContain("Mohon fade rapi samping tipis");
    expect(input).toContain("END:VCALENDAR");
  });

  it("renders truthful status badge from Badge component (Terkonfirmasi)", () => {
    const html = renderClean(
      <BookingConfirmationCard
        appointment={mockAppointment}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization="Master Barber"
      />,
    );

    expect(html).toContain("Terkonfirmasi");
  });

  it("omits location section when no authoritative shop location is provided", () => {
    const html = renderClean(
      <BookingConfirmationCard
        appointment={mockAppointment}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization="Senior Stylist"
      />,
    );

    expect(html).not.toContain("Lokasi");
    expect(html).not.toContain("BarberKece Studio");
    expect(html).not.toContain("Jakarta");
  });

  it("renders location only when explicitly provided with authoritative data", () => {
    const html = renderClean(
      <BookingConfirmationCard
        appointment={mockAppointment}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization="Senior Stylist"
        shopName="BarberKece Pusat"
        shopLocation="Jl. Thamrin No. 10, Jakarta"
      />,
    );

    expect(html).toContain("Lokasi");
    expect(html).toContain("BarberKece Pusat");
    expect(html).toContain("Jl. Thamrin No. 10, Jakarta");
  });

  it("renders neutral 'Barber Staff' fallback when barberSpecialization is null without false claims", () => {
    const html = renderClean(
      <BookingConfirmationCard
        appointment={mockAppointment}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization={null}
      />,
    );

    expect(html).toContain("Barber Staff");
    expect(html).not.toContain("Siapa Saja yang Tersedia");
  });

  it("displays non-success header and hides Add to Calendar button for cancelled appointments", () => {
    const cancelledAppointment: BookingConfirmationAppointment = {
      ...mockAppointment,
      status: "CANCELLED_BY_CUSTOMER",
    };

    const html = renderClean(
      <BookingConfirmationCard
        appointment={cancelledAppointment}
        serviceName="Gentlemen Classic Cut"
        barberSpecialization="Senior Stylist"
      />,
    );

    expect(html).toContain("Detail Reservasi");
    expect(html).not.toContain("Reservasi Berhasil");
    expect(html).toContain("Dibatalkan (Pelanggan)");
    expect(html).not.toContain("Tambah ke Kalender (.ics)");
  });
});
