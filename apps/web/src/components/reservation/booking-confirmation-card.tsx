"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  CalendarIcon,
  ClockIcon,
  ScissorsIcon,
  UserIcon,
  DownloadIcon,
  InfoIcon,
} from "@/components/ui/icons";
import {
  formatRupiah,
  formatTimeWib,
  formatDateIndonesian,
} from "@/lib/format";
import { generateIcsContent, downloadIcsFile } from "@/lib/calendar";
import { Badge } from "@/components/ui/badge";

export interface BookingConfirmationAppointment {
  id: string;
  bookingReference: string;
  status: string;
  startsAt: string;
  endsAt: string;
  serviceDurationMinutes: number;
  priceRupiah: number;
  notes: string | null;
  isAutoAssigned: boolean;
}

export interface BookingConfirmationCardProps {
  appointment: BookingConfirmationAppointment;
  serviceName: string;
  barberSpecialization: string | null;
  shopName?: string;
  shopLocation?: string;
  onDownloadCalendar?: () => void;
}

export function buildCalendarAppointmentInput(
  appointment: BookingConfirmationAppointment,
  serviceName: string,
  barberSpecialization: string | null,
  shopLocation?: string,
) {
  return {
    bookingReference: appointment.bookingReference,
    serviceName,
    barberName: barberSpecialization ?? undefined,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    location: shopLocation ?? undefined,
    notes: appointment.notes,
  };
}

export function BookingConfirmationCard({
  appointment,
  serviceName,
  barberSpecialization,
  shopName,
  shopLocation,
  onDownloadCalendar,
}: BookingConfirmationCardProps) {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Extract date in YYYY-MM-DD from startsAt
  const dateStr = appointment.startsAt.slice(0, 10);
  const isConfirmed = appointment.status === "CONFIRMED";

  const handleDownloadCalendar = () => {
    if (onDownloadCalendar) {
      onDownloadCalendar();
      return;
    }

    try {
      const ics = generateIcsContent(
        buildCalendarAppointmentInput(
          appointment,
          serviceName,
          barberSpecialization,
          shopLocation,
        ),
      );

      const success = downloadIcsFile(
        `barberkece-${appointment.bookingReference}.ics`,
        ics,
      );
      if (success) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
      }
    } catch {
      // Fallback silently if generation fails
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Success / Status Card Header */}
      <div className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-6 sm:p-8 text-center shadow-xs">
        <div className="flex justify-center mb-3">
          <Badge status={appointment.status} />
        </div>

        {isConfirmed ? (
          <>
            <div className="h-16 w-16 bg-[#2F7D4A]/10 border border-[#2F7D4A]/30 rounded-full flex items-center justify-center mx-auto text-[#2F7D4A]">
              <CheckIcon size={32} />
            </div>

            <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#11110F]">
              Reservasi Berhasil
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6E6C65] max-w-md mx-auto">
              Terima kasih. Jadwal kunjungan potong rambut Anda telah tercatat
              dan dikonfirmasi dalam sistem kami.
            </p>
          </>
        ) : (
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#11110F]">
            Detail Reservasi
          </h1>
        )}

        {/* Booking Reference Box */}
        <div className="mt-6 p-4 bg-[#F3F0E8] border border-[#D8D4CA] rounded-xl inline-block max-w-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E6C65]">
            Kode Reservasi
          </p>
          <p
            data-testid="booking-reference-display"
            className="text-xl sm:text-2xl font-black uppercase tracking-widest text-[#11110F] mt-0.5"
          >
            {appointment.bookingReference}
          </p>
          <p className="text-[10px] text-[#6E6C65] mt-1">
            Simpan kode ini untuk ditunjukkan kepada kasir/barber saat tiba di
            lokasi.
          </p>
        </div>
      </div>

      {/* Appointment Receipt Details */}
      <div className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-6 sm:p-8 shadow-xs">
        <h2 className="text-base font-bold uppercase tracking-wider text-[#11110F] pb-3 border-b border-[#D8D4CA]">
          Rincian Reservasi
        </h2>

        <dl className="mt-4 space-y-4 divide-y divide-[#D8D4CA]/60 text-sm">
          {/* Service */}
          <div className="pt-3 first:pt-0 flex justify-between items-start gap-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
              <ScissorsIcon size={16} className="text-[#11110F]" />
              Layanan
            </dt>
            <dd className="text-right">
              <p className="font-bold text-[#11110F]">{serviceName}</p>
              <p className="text-xs text-[#6E6C65]">
                {appointment.serviceDurationMinutes} menit
              </p>
            </dd>
          </div>

          {/* Barber */}
          <div className="pt-3 flex justify-between items-start gap-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
              <UserIcon size={16} className="text-[#11110F]" />
              Barber
            </dt>
            <dd className="text-right">
              <p className="font-bold text-[#11110F]">
                {barberSpecialization ?? "Barber Staff"}
              </p>
              {appointment.isAutoAssigned && (
                <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#2F7D4A]/10 text-[#2F7D4A] rounded">
                  Ditugaskan Otomatis
                </span>
              )}
            </dd>
          </div>

          {/* Date */}
          <div className="pt-3 flex justify-between items-start gap-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
              <CalendarIcon size={16} className="text-[#11110F]" />
              Tanggal
            </dt>
            <dd className="font-bold text-[#11110F] text-right">
              {formatDateIndonesian(dateStr)}
            </dd>
          </div>

          {/* Time */}
          <div className="pt-3 flex justify-between items-start gap-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
              <ClockIcon size={16} className="text-[#11110F]" />
              Waktu
            </dt>
            <dd className="font-bold text-[#11110F] text-right">
              {formatTimeWib(appointment.startsAt)} -{" "}
              {formatTimeWib(appointment.endsAt)} WIB
            </dd>
          </div>

          {/* Location (only rendered when supported by authoritative data) */}
          {shopLocation && (
            <div className="pt-3 flex justify-between items-start gap-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
                <InfoIcon size={16} className="text-[#11110F]" />
                Lokasi
              </dt>
              <dd className="text-right">
                {shopName && (
                  <p className="font-bold text-[#11110F]">{shopName}</p>
                )}
                <p className="text-xs text-[#6E6C65]">{shopLocation}</p>
              </dd>
            </div>
          )}

          {/* Notes (if provided) */}
          {appointment.notes && (
            <div className="pt-3 flex justify-between items-start gap-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
                Catatan
              </dt>
              <dd className="text-right text-xs text-[#11110F] italic max-w-xs">
                &ldquo;{appointment.notes}&rdquo;
              </dd>
            </div>
          )}

          {/* Price */}
          <div className="pt-4 flex justify-between items-baseline gap-4 border-t-2 border-[#11110F]">
            <dt className="text-xs font-extrabold uppercase tracking-wider text-[#11110F]">
              Total Biaya
            </dt>
            <dd className="text-xl font-black text-[#11110F]">
              {formatRupiah(appointment.priceRupiah)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Add to Calendar button (only available for confirmed reservations) */}
        {isConfirmed && (
          <button
            type="button"
            onClick={handleDownloadCalendar}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#C9F23B] text-[#11110F] text-xs sm:text-sm font-extrabold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#b4db29] focus:outline-none focus:ring-2 focus:ring-[#11110F] shadow-sm cursor-pointer"
          >
            <DownloadIcon size={18} />
            {downloadSuccess
              ? "Kalender Tersimpan!"
              : "Tambah ke Kalender (.ics)"}
          </button>
        )}

        {/* View Appointment Details Link */}
        <Link
          href={`/account/appointments/${appointment.id}`}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#11110F] text-[#FAF8F3] text-xs sm:text-sm font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] shadow-sm text-center"
        >
          Lihat Detail Janji Temu
        </Link>

        {/* Back to Home Link */}
        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-wider text-[#6E6C65] hover:text-[#11110F] transition-colors underline underline-offset-4"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
