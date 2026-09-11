import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  ClockIcon,
  ScissorsIcon,
  UserIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import {
  formatRupiah,
  formatTimeWib,
  formatDateIndonesian,
} from "@/lib/format";

export interface AppointmentCardData {
  id: string;
  bookingReference: string;
  status: string;
  startsAt: string;
  endsAt: string;
  priceRupiah: number;
  serviceId?: string;
  serviceDurationMinutes?: number;
  serviceName?: string | null;
  barberSpecialization?: string | null;
  isAutoAssigned?: boolean;
}

export interface AppointmentCardProps {
  appointment: AppointmentCardData;
}

export function AppointmentCard({ appointment }: AppointmentCardProps) {
  const dateStr = appointment.startsAt.slice(0, 10);
  const barberLabel = appointment.barberSpecialization ?? "Barber Staff";

  return (
    <article
      data-testid={`appointment-card-${appointment.id}`}
      className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-5 sm:p-6 transition-all duration-200 hover:border-[#11110F]/40 shadow-xs flex flex-col justify-between gap-4"
    >
      <div className="space-y-3">
        {/* Header: Booking Reference & Status Badge */}
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#D8D4CA]/50 pb-3">
          <span
            data-testid="card-booking-reference"
            className="font-mono text-sm sm:text-base font-black tracking-wider text-[#11110F]"
          >
            {appointment.bookingReference}
          </span>
          <Badge status={appointment.status} />
        </div>

        {/* Service & Duration */}
        <div className="flex items-start gap-2.5">
          <ScissorsIcon
            size={18}
            className="text-[#11110F] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[#11110F]">
              {appointment.serviceName ?? "Layanan Potong Rambut"}
            </h3>
            {appointment.serviceDurationMinutes ? (
              <p className="text-xs text-[#6E6C65]">
                {appointment.serviceDurationMinutes} menit
              </p>
            ) : null}
          </div>
        </div>

        {/* Barber */}
        <div className="flex items-center gap-2.5 text-xs text-[#11110F]">
          <UserIcon
            size={18}
            className="text-[#11110F] shrink-0"
            aria-hidden="true"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{barberLabel}</span>
            {appointment.isAutoAssigned && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#2F7D4A]/10 text-[#2F7D4A] rounded">
                Ditugaskan Otomatis
              </span>
            )}
          </div>
        </div>

        {/* Schedule: Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-[#11110F]">
          <div className="flex items-center gap-2">
            <CalendarIcon
              size={16}
              className="text-[#6E6C65] shrink-0"
              aria-hidden="true"
            />
            <span>{formatDateIndonesian(dateStr)}</span>
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon
              size={16}
              className="text-[#6E6C65] shrink-0"
              aria-hidden="true"
            />
            <span>
              {formatTimeWib(appointment.startsAt)} -{" "}
              {formatTimeWib(appointment.endsAt)} WIB
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Price & Detail CTA */}
      <div className="pt-3 border-t border-[#D8D4CA]/50 flex items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6C65] block">
            Total Biaya
          </span>
          <span className="font-black text-sm sm:text-base text-[#11110F]">
            {formatRupiah(appointment.priceRupiah)}
          </span>
        </div>

        <Link
          href={`/account/appointments/${appointment.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
        >
          <span>Detail</span>
          <ChevronRightIcon size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
