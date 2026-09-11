import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { AppointmentCard, AppointmentCardData } from "../appointment-card";

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

describe("AppointmentCard Component", () => {
  const baseAppointment: AppointmentCardData = {
    id: "11111111-2222-4333-8444-555555555555",
    bookingReference: "BK-20260915-ABC",
    serviceId: "srv-1",
    serviceName: "Gentlemen Classic Cut",
    serviceDurationMinutes: 45,
    barberSpecialization: "Senior Stylist",
    status: "CONFIRMED",
    startsAt: "2026-09-15T03:00:00.000Z", // 10.00 WIB
    endsAt: "2026-09-15T03:45:00.000Z", // 10.45 WIB
    priceRupiah: 120000,
    isAutoAssigned: true,
  };

  it("renders booking reference, service name, duration, date, time, and price", () => {
    const html = renderClean(<AppointmentCard appointment={baseAppointment} />);

    expect(html).toContain("BK-20260915-ABC");
    expect(html).toContain("Gentlemen Classic Cut");
    expect(html).toContain("45 menit");
    expect(html).toContain("Selasa, 15 September 2026");
    expect(html).toContain("10.00 - 10.45 WIB");
    expect(html).toContain("Rp 120.000");
  });

  it("renders status badge accurately using Badge component", () => {
    const html = renderClean(<AppointmentCard appointment={baseAppointment} />);

    expect(html).toContain("Terkonfirmasi");
  });

  it("renders auto-assigned badge when isAutoAssigned is true", () => {
    const html = renderClean(<AppointmentCard appointment={baseAppointment} />);

    expect(html).toContain("Ditugaskan Otomatis");
  });

  it("renders neutral 'Barber Staff' fallback when barberSpecialization is absent", () => {
    const appointmentNoBarber: AppointmentCardData = {
      ...baseAppointment,
      barberSpecialization: null,
      isAutoAssigned: false,
    };

    const html = renderClean(
      <AppointmentCard appointment={appointmentNoBarber} />,
    );

    expect(html).toContain("Barber Staff");
    expect(html).not.toContain("Ditugaskan Otomatis");
  });

  it("renders fallback service name when serviceName is absent", () => {
    const appointmentNoService: AppointmentCardData = {
      ...baseAppointment,
      serviceName: null,
      serviceDurationMinutes: undefined,
    };

    const html = renderClean(
      <AppointmentCard appointment={appointmentNoService} />,
    );

    expect(html).toContain("Layanan Potong Rambut");
  });

  it("renders detail CTA link targeting owned appointment id", () => {
    const html = renderClean(<AppointmentCard appointment={baseAppointment} />);

    expect(html).toContain(
      `href="/account/appointments/${baseAppointment.id}"`,
    );
    expect(html).toContain("Detail");
  });

  it("renders canonical badge for other appointment statuses accurately", () => {
    const statuses = [
      { status: "CHECKED_IN", label: "Check-In" },
      { status: "IN_SERVICE", label: "Sedang Dilayani" },
      { status: "COMPLETED", label: "Selesai" },
      { status: "CANCELLED_BY_BARBERSHOP", label: "Dibatalkan (Barbershop)" },
      { status: "NO_SHOW", label: "Tidak Hadir" },
    ];

    for (const { status, label } of statuses) {
      const html = renderClean(
        <AppointmentCard appointment={{ ...baseAppointment, status }} />,
      );
      expect(html).toContain(label);
    }
  });

  it("does not render any fabricated location text", () => {
    const html = renderClean(<AppointmentCard appointment={baseAppointment} />);

    // Ensure no made-up store locations
    expect(html).not.toContain("Jl.");
    expect(html).not.toContain("Jakarta");
    expect(html).not.toContain("Mall");
  });
});
