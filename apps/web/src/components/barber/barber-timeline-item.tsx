"use client";

import React from "react";
import Link from "next/link";
import { BarberAppointmentDto } from "@barberkece/contracts";
import { Badge } from "@/components/ui/badge";
import { ClockIcon, ScissorsIcon, InfoIcon } from "@/components/ui/icons";
import { formatRupiah, formatTimeWib } from "@/lib/format";
import {
  getAllowedOperationalActions,
  OperationalAction,
} from "./barber-workspace-helpers";

export interface BarberTimelineItemProps {
  appointment: BarberAppointmentDto;
  onAction: (appointmentId: string, action: OperationalAction) => void;
  isMutating?: boolean;
}

export function BarberTimelineItem({
  appointment,
  onAction,
  isMutating = false,
}: BarberTimelineItemProps) {
  const allowedActions = getAllowedOperationalActions(appointment.status);

  return (
    <article
      data-testid={`barber-appointment-item-${appointment.id}`}
      className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-5 sm:p-6 transition-all duration-150 hover:border-[#11110F]/30 shadow-xs flex flex-col justify-between gap-4"
    >
      <div className="space-y-3">
        {/* Header: Time & Status Badge */}
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#D8D4CA]/50 pb-3">
          <div className="flex items-center gap-2">
            <ClockIcon
              size={16}
              className="text-[#6E6C65] shrink-0"
              aria-hidden="true"
            />
            <span
              data-testid="item-time"
              className="font-bold text-sm sm:text-base text-[#11110F]"
            >
              {formatTimeWib(appointment.startsAt)} -{" "}
              {formatTimeWib(appointment.endsAt)} WIB
            </span>
          </div>
          <Badge status={appointment.status} />
        </div>

        {/* Reference & Service Snapshot */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#6E6C65]">Ref:</span>
            <Link
              href={`/barber/appointments/${appointment.id}`}
              className="hover:underline focus:outline-none focus:ring-1 focus:ring-[#C9F23B] rounded"
            >
              <span
                data-testid="item-booking-reference"
                className="font-mono font-black tracking-wider text-[#11110F]"
              >
                #{appointment.bookingReference}
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2 text-[#6E6C65]">
            <ScissorsIcon size={14} className="shrink-0" aria-hidden="true" />
            <span>
              {appointment.serviceDurationMinutes} menit •{" "}
              <strong className="text-[#11110F] font-bold">
                {formatRupiah(appointment.priceRupiah)}
              </strong>
            </span>
          </div>
        </div>

        {/* Notes (if provided) */}
        {appointment.notes && (
          <div className="p-2.5 bg-[#F3F0E8] border border-[#D8D4CA]/60 rounded-xl text-xs text-[#11110F] flex items-start gap-2">
            <InfoIcon
              size={14}
              className="text-[#6E6C65] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <span className="font-semibold text-[#6E6C65]">Catatan:</span>{" "}
              {appointment.notes}
            </div>
          </div>
        )}

        {/* Cancellation Reason (if present) */}
        {appointment.cancellationReason && (
          <div className="p-2.5 bg-[#B63D37]/5 border border-[#B63D37]/20 rounded-xl text-xs text-[#B63D37] flex items-start gap-2">
            <InfoIcon
              size={14}
              className="shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <span className="font-semibold">Alasan Batal:</span>{" "}
              {appointment.cancellationReason}
            </div>
          </div>
        )}
      </div>

      {/* Operational Actions (if non-terminal) */}
      {allowedActions.length > 0 && (
        <div className="pt-3 border-t border-[#D8D4CA]/50 flex items-center justify-end gap-2 flex-wrap">
          {allowedActions.includes("CHECK_IN") && (
            <button
              type="button"
              disabled={isMutating}
              data-testid={`check-in-btn-${appointment.id}`}
              onClick={() => onAction(appointment.id, "CHECK_IN")}
              className="px-3.5 py-2 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] cursor-pointer disabled:opacity-50"
            >
              Check-In
            </button>
          )}

          {allowedActions.includes("START_SERVICE") && (
            <button
              type="button"
              disabled={isMutating}
              data-testid={`start-service-btn-${appointment.id}`}
              onClick={() => onAction(appointment.id, "START_SERVICE")}
              className="px-3.5 py-2 bg-[#C9F23B] text-[#11110F] text-xs font-extrabold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#b5dc30] focus:outline-none focus:ring-2 focus:ring-[#11110F] cursor-pointer shadow-xs disabled:opacity-50"
            >
              Mulai Layanan
            </button>
          )}

          {allowedActions.includes("COMPLETE") && (
            <button
              type="button"
              disabled={isMutating}
              data-testid={`complete-btn-${appointment.id}`}
              onClick={() => onAction(appointment.id, "COMPLETE")}
              className="px-3.5 py-2 bg-[#2F7D4A] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#27663d] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] cursor-pointer disabled:opacity-50"
            >
              Selesaikan Layanan
            </button>
          )}

          {allowedActions.includes("NO_SHOW") && (
            <button
              type="button"
              disabled={isMutating}
              data-testid={`no-show-btn-${appointment.id}`}
              onClick={() => onAction(appointment.id, "NO_SHOW")}
              className="px-3 py-2 border border-[#A66A16]/50 text-[#A66A16] hover:bg-[#A66A16]/10 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#A66A16] cursor-pointer disabled:opacity-50"
            >
              Tidak Hadir (No Show)
            </button>
          )}

          {allowedActions.includes("CANCEL") && (
            <button
              type="button"
              disabled={isMutating}
              data-testid={`cancel-btn-${appointment.id}`}
              onClick={() => onAction(appointment.id, "CANCEL")}
              className="px-3 py-2 border border-[#B63D37]/40 text-[#B63D37] hover:bg-[#B63D37]/10 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#B63D37] cursor-pointer disabled:opacity-50"
            >
              Batalkan
            </button>
          )}
        </div>
      )}
    </article>
  );
}
