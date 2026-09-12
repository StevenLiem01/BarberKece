"use client";

import React from "react";
import { BarberAppointmentDto } from "@barberkece/contracts";
import { Badge } from "@/components/ui/badge";
import {
  ClockIcon,
  ScissorsIcon,
  InfoIcon,
  CheckIcon,
} from "@/components/ui/icons";
import { formatRupiah, formatTimeWib } from "@/lib/format";
import {
  SpotlightType,
  getAllowedOperationalActions,
  OperationalAction,
} from "./barber-workspace-helpers";

export interface BarberSpotlightCardProps {
  appointment: BarberAppointmentDto | null;
  type: SpotlightType | null;
  totalAppointmentsToday: number;
  onAction: (appointmentId: string, action: OperationalAction) => void;
  isMutating?: boolean;
}

export function BarberSpotlightCard({
  appointment,
  type,
  totalAppointmentsToday,
  onAction,
  isMutating = false,
}: BarberSpotlightCardProps) {
  // If no active or next spotlight
  if (!appointment || !type) {
    if (totalAppointmentsToday > 0) {
      return (
        <section
          aria-label="Status Operasional Spotlight"
          data-testid="barber-spotlight-card"
          className="bg-[#FAF8F3] border-2 border-[#D8D4CA] rounded-2xl p-5 sm:p-6 shadow-xs flex items-center gap-4"
        >
          <div className="h-12 w-12 rounded-full bg-[#2F7D4A]/10 text-[#2F7D4A] flex items-center justify-center shrink-0">
            <CheckIcon size={24} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-tight text-[#11110F]">
              Semua Jadwal Hari Ini Telah Selesai
            </h2>
            <p className="text-xs text-[#6E6C65] mt-0.5">
              Tidak ada janji temu aktif atau mendatang yang membutuhkan
              tindakan operasional saat ini.
            </p>
          </div>
        </section>
      );
    }
    return null;
  }

  const allowedActions = getAllowedOperationalActions(appointment.status);

  // Spotlight header metadata based on priority type
  let badgeLabel = "Janji Temu Berikutnya";
  let badgeStyle = "bg-[#11110F] text-[#FAF8F3]";
  let containerBorder = "border-[#11110F]";

  if (type === "IN_SERVICE") {
    badgeLabel = "FOKUS AKTIF • SEDANG DILAYANI";
    badgeStyle = "bg-[#C9F23B] text-[#11110F] font-black";
    containerBorder = "border-[#11110F] ring-2 ring-[#C9F23B]";
  } else if (type === "CHECKED_IN") {
    badgeLabel = "FOKUS AKTIF • PELANGGAN SUDAH CHECK-IN";
    badgeStyle = "bg-[#3E667D] text-[#FAF8F3] font-bold";
    containerBorder = "border-[#3E667D]";
  } else if (type === "CONFIRMED_OVERDUE") {
    badgeLabel = "TERTUNDA • BELUM CHECK-IN";
    badgeStyle = "bg-[#A66A16] text-[#FAF8F3] font-bold";
    containerBorder = "border-[#A66A16]";
  }

  return (
    <section
      aria-label="Janji Temu Prioritas Saat Ini"
      data-testid="barber-spotlight-card"
      className={`bg-[#FAF8F3] border-2 ${containerBorder} rounded-2xl p-5 sm:p-7 shadow-md space-y-5 transition-all`}
    >
      {/* Top Banner Tag */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span
          data-testid="spotlight-tag"
          className={`px-3 py-1 text-[11px] sm:text-xs uppercase tracking-wider rounded-lg ${badgeStyle}`}
        >
          {badgeLabel}
        </span>
        <Badge status={appointment.status} />
      </div>

      {/* Main Focus Row: Large Time & Reference */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-[#D8D4CA]/60 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6C65] block mb-1">
            Waktu Layanan
          </span>
          <div className="flex items-center gap-2.5">
            <ClockIcon
              size={22}
              className="text-[#11110F] shrink-0"
              aria-hidden="true"
            />
            <h3
              data-testid="spotlight-time"
              className="font-extrabold text-xl sm:text-2xl text-[#11110F] tracking-tight"
            >
              {formatTimeWib(appointment.startsAt)} -{" "}
              {formatTimeWib(appointment.endsAt)} WIB
            </h3>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6C65] block mb-1">
            No. Booking Ref
          </span>
          <span
            data-testid="spotlight-reference"
            className="font-mono font-black text-base sm:text-lg tracking-wider text-[#11110F]"
          >
            #{appointment.bookingReference}
          </span>
        </div>
      </div>

      {/* Details Snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#11110F]">
        <div className="flex items-center gap-2 p-3 bg-[#F3F0E8] rounded-xl border border-[#D8D4CA]/50">
          <ScissorsIcon
            size={16}
            className="text-[#11110F] shrink-0"
            aria-hidden="true"
          />
          <span>
            Durasi: <strong>{appointment.serviceDurationMinutes} menit</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 p-3 bg-[#F3F0E8] rounded-xl border border-[#D8D4CA]/50">
          <span className="text-[#6E6C65] font-semibold">Biaya:</span>
          <span className="font-extrabold">
            {formatRupiah(appointment.priceRupiah)}
          </span>
        </div>
      </div>

      {/* Notes if any */}
      {appointment.notes && (
        <div className="p-3 bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl text-xs text-[#11110F] flex items-start gap-2">
          <InfoIcon
            size={15}
            className="text-[#6E6C65] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <strong className="text-[#11110F]">Catatan Pelanggan:</strong>{" "}
            {appointment.notes}
          </div>
        </div>
      )}

      {/* Spotlight Operational Actions */}
      {allowedActions.length > 0 && (
        <div className="pt-2 flex items-center justify-end gap-2 flex-wrap">
          {allowedActions.includes("CHECK_IN") && (
            <button
              type="button"
              disabled={isMutating}
              data-testid={`spotlight-check-in-btn-${appointment.id}`}
              onClick={() => onAction(appointment.id, "CHECK_IN")}
              className="px-5 py-2.5 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] cursor-pointer disabled:opacity-50"
            >
              Check-In Sekarang
            </button>
          )}

          {allowedActions.includes("START_SERVICE") && (
            <button
              type="button"
              disabled={isMutating}
              data-testid={`spotlight-start-service-btn-${appointment.id}`}
              onClick={() => onAction(appointment.id, "START_SERVICE")}
              className="px-5 py-2.5 bg-[#C9F23B] text-[#11110F] text-xs font-extrabold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#b5dc30] focus:outline-none focus:ring-2 focus:ring-[#11110F] cursor-pointer shadow-xs disabled:opacity-50"
            >
              Mulai Layanan Sekarang
            </button>
          )}

          {allowedActions.includes("COMPLETE") && (
            <button
              type="button"
              disabled={isMutating}
              data-testid={`spotlight-complete-btn-${appointment.id}`}
              onClick={() => onAction(appointment.id, "COMPLETE")}
              className="px-5 py-2.5 bg-[#2F7D4A] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#27663d] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] cursor-pointer disabled:opacity-50"
            >
              Selesaikan Layanan
            </button>
          )}

          {allowedActions.includes("NO_SHOW") && (
            <button
              type="button"
              disabled={isMutating}
              data-testid={`spotlight-no-show-btn-${appointment.id}`}
              onClick={() => onAction(appointment.id, "NO_SHOW")}
              className="px-4 py-2.5 border border-[#A66A16]/50 text-[#A66A16] hover:bg-[#A66A16]/10 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#A66A16] cursor-pointer disabled:opacity-50"
            >
              Tidak Hadir (No Show)
            </button>
          )}

          {allowedActions.includes("CANCEL") && (
            <button
              type="button"
              disabled={isMutating}
              data-testid={`spotlight-cancel-btn-${appointment.id}`}
              onClick={() => onAction(appointment.id, "CANCEL")}
              className="px-4 py-2.5 border border-[#B63D37]/40 text-[#B63D37] hover:bg-[#B63D37]/10 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#B63D37] cursor-pointer disabled:opacity-50"
            >
              Batalkan
            </button>
          )}
        </div>
      )}
    </section>
  );
}
