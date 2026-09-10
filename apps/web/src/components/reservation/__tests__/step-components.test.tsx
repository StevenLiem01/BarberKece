import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { StepIndicator } from "../step-indicator";
import { BookingSummarySidebar } from "../booking-summary-sidebar";
import { ServiceStep } from "../service-step";
import { BarberStep } from "../barber-step";
import { DateStep } from "../date-step";
import { TimeStep } from "../time-step";
import { ReviewStep } from "../review-step";
import {
  PublicServiceDto,
  PublicBarberDto,
  PublicAvailableSlotDto,
} from "@barberkece/contracts";

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

const mockService: PublicServiceDto = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Gentlemen Classic Cut",
  durationMinutes: 45,
  priceRupiah: 120000,
  description: "Potongan rambut klasik profesional dengan cuci rambut.",
};

const mockBarber: PublicBarberDto = {
  id: "22222222-2222-4222-8222-222222222222",
  specialization: "Fade & Pompadour Specialist",
};

const mockSlot: PublicAvailableSlotDto = {
  startsAt: "2026-09-15T02:00:00.000Z",
  endsAt: "2026-09-15T02:45:00.000Z",
};

describe("Reservation Step Components", () => {
  describe("StepIndicator", () => {
    it("renders all 5 steps with accessible aria-current on the active step", () => {
      const html = renderClean(<StepIndicator currentStep={3} />);

      expect(html).toContain("Layanan");
      expect(html).toContain("Barber");
      expect(html).toContain("Tanggal");
      expect(html).toContain("Waktu");
      expect(html).toContain("Ringkasan");
      expect(html).toContain('aria-current="step"');
    });

    it("renders completed check marks for steps prior to currentStep", () => {
      const html = renderClean(<StepIndicator currentStep={4} />);
      expect(html).toContain("bg-[#2F7D4A]");
    });
  });

  describe("BookingSummarySidebar", () => {
    it("renders unselected empty state for all fields initially", () => {
      const html = renderClean(
        <BookingSummarySidebar
          service={null}
          barber={null}
          isAnyBarber={true}
          date={null}
          slot={null}
        />,
      );

      expect(html).toContain("Ringkasan Reservasi");
      expect(html).toContain("Belum dipilih");
      expect(html).toContain("—");
    });

    it("renders full progressive summary when all fields are selected", () => {
      const html = renderClean(
        <BookingSummarySidebar
          service={mockService}
          barber={mockBarber}
          isAnyBarber={false}
          date="2026-09-15"
          slot={mockSlot}
        />,
      );

      expect(html).toContain("Gentlemen Classic Cut");
      expect(html).toContain("45 menit");
      expect(html).toContain("Fade &amp; Pompadour Specialist");
      expect(html).toContain("15 September 2026");
      expect(html).toContain("09.00 - 09.45 WIB");
      expect(html).toContain("120.000");
    });

    it("renders Any Available notice when isAnyBarber is true", () => {
      const html = renderClean(
        <BookingSummarySidebar
          service={mockService}
          barber={null}
          isAnyBarber={true}
          date="2026-09-15"
          slot={mockSlot}
        />,
      );

      expect(html).toContain("Siapa Saja yang Tersedia");
      expect(html).toContain("Penugasan otomatis saat konfirmasi");
    });
  });

  describe("ServiceStep", () => {
    it("renders loading skeleton when isLoading is true", () => {
      const html = renderClean(
        <ServiceStep
          services={[]}
          isLoading={true}
          error={null}
          onRetry={vi.fn()}
          selectedService={null}
          onSelectService={vi.fn()}
          onNext={vi.fn()}
        />,
      );

      expect(html).toContain('role="status"');
      expect(html).toContain("animate-pulse");
    });

    it("renders error message and retry button on error", () => {
      const html = renderClean(
        <ServiceStep
          services={[]}
          isLoading={false}
          error="Koneksi bermasalah"
          onRetry={vi.fn()}
          selectedService={null}
          onSelectService={vi.fn()}
          onNext={vi.fn()}
        />,
      );

      expect(html).toContain("Koneksi bermasalah");
      expect(html).toContain("Coba Lagi");
    });

    it("renders service list and disables next button when none selected", () => {
      const html = renderClean(
        <ServiceStep
          services={[mockService]}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
          selectedService={null}
          onSelectService={vi.fn()}
          onNext={vi.fn()}
        />,
      );

      expect(html).toContain("Gentlemen Classic Cut");
      expect(html).toContain('disabled=""');
    });

    it("enables next button and marks card as selected when selectedService is set", () => {
      const html = renderClean(
        <ServiceStep
          services={[mockService]}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
          selectedService={mockService}
          onSelectService={vi.fn()}
          onNext={vi.fn()}
        />,
      );

      expect(html).toContain("Terpilih");
      expect(html).not.toContain('disabled=""');
    });
  });

  describe("BarberStep", () => {
    it("renders Any Available and specific barber options", () => {
      const html = renderClean(
        <BarberStep
          barbers={[mockBarber]}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
          selectedBarber={null}
          isAnyBarber={true}
          onSelectAnyBarber={vi.fn()}
          onSelectSpecificBarber={vi.fn()}
          onBack={vi.fn()}
          onNext={vi.fn()}
        />,
      );

      expect(html).toContain("Siapa Saja yang Tersedia");
      expect(html).toContain("Fade &amp; Pompadour Specialist");
      expect(html).toContain("Rekomendasi");
    });
  });

  describe("DateStep", () => {
    it("renders date horizon list and native date input with min/max bounds", () => {
      const html = renderClean(
        <DateStep
          selectedDate="2026-09-15"
          onSelectDate={vi.fn()}
          onBack={vi.fn()}
          onNext={vi.fn()}
          bookingHorizonDays={30}
        />,
      );

      expect(html).toContain('id="date-picker-input"');
      expect(html).toContain('type="date"');
      expect(html).toContain("Tanggal Terpilih");
      expect(html).toContain("15 September 2026");
    });
  });

  describe("TimeStep", () => {
    it("renders empty state with suggestion to switch to Any Available if specific barber is empty", () => {
      const html = renderClean(
        <TimeStep
          slots={[]}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
          selectedSlot={null}
          onSelectSlot={vi.fn()}
          isSpecificBarber={true}
          onSwitchToAnyBarber={vi.fn()}
          onChangeDate={vi.fn()}
          onBack={vi.fn()}
          onNext={vi.fn()}
        />,
      );

      expect(html).toContain("Tidak Ada Slot Tersedia");
      expect(html).toContain("Cari Siapa Saja yang Tersedia");
      expect(html).toContain("Ubah Tanggal");
    });

    it("renders slot buttons and highlights selected slot", () => {
      const html = renderClean(
        <TimeStep
          slots={[mockSlot]}
          isLoading={false}
          error={null}
          onRetry={vi.fn()}
          selectedSlot={mockSlot}
          onSelectSlot={vi.fn()}
          isSpecificBarber={false}
          onSwitchToAnyBarber={vi.fn()}
          onChangeDate={vi.fn()}
          onBack={vi.fn()}
          onNext={vi.fn()}
        />,
      );

      expect(html).toContain("09.00");
      expect(html).toContain("s.d. 09.45 WIB");
      expect(html).toContain('aria-checked="true"');
      expect(html).not.toContain('disabled=""');
    });
  });

  describe("ReviewStep", () => {
    it("renders summary, cancellation notice, and authenticated confirmation CTA", () => {
      const html = renderClean(
        <ReviewStep
          service={mockService}
          barber={mockBarber}
          isAnyBarber={false}
          date="2026-09-15"
          slot={mockSlot}
          notes="Mohon rapi"
          onNotesChange={vi.fn()}
          isAuthenticated={true}
          isSubmitting={false}
          submitError={null}
          onConfirm={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(html).toContain("Tinjau &amp; Konfirmasi Reservasi");
      expect(html).toContain("Kebijakan Reservasi");
      expect(html).toContain("2 jam");
      expect(html).toContain("Konfirmasi Reservasi");
      expect(html).not.toContain("Masuk untuk Konfirmasi");
    });

    it("renders guest sign-in CTA when unauthenticated", () => {
      const html = renderClean(
        <ReviewStep
          service={mockService}
          barber={null}
          isAnyBarber={true}
          date="2026-09-15"
          slot={mockSlot}
          notes=""
          onNotesChange={vi.fn()}
          isAuthenticated={false}
          isSubmitting={false}
          submitError={null}
          onConfirm={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(html).toContain("Masuk untuk Konfirmasi Reservasi →");
      expect(html).toContain("Anda belum masuk.");
    });

    it("renders submit error message banner when submitError is provided", () => {
      const html = renderClean(
        <ReviewStep
          service={mockService}
          barber={null}
          isAnyBarber={true}
          date="2026-09-15"
          slot={mockSlot}
          notes=""
          onNotesChange={vi.fn()}
          isAuthenticated={true}
          isSubmitting={false}
          submitError="Slot ini sudah diambil orang lain"
          onConfirm={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain("Konfirmasi Gagal");
      expect(html).toContain("Slot ini sudah diambil orang lain");
    });
  });
});
