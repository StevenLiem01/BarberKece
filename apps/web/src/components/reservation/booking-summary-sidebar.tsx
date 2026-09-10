import React from "react";
import {
  PublicServiceDto,
  PublicBarberDto,
  PublicAvailableSlotDto,
} from "@barberkece/contracts";
import {
  CalendarIcon,
  ClockIcon,
  ScissorsIcon,
  UserIcon,
} from "@/components/ui/icons";
import {
  formatRupiah,
  formatTimeWib,
  formatDateIndonesian,
} from "@/lib/format";

export interface BookingSummarySidebarProps {
  service: PublicServiceDto | null;
  barber: PublicBarberDto | null;
  isAnyBarber: boolean;
  date: string | null;
  slot: PublicAvailableSlotDto | null;
}

export function BookingSummarySidebar({
  service,
  barber,
  isAnyBarber,
  date,
  slot,
}: BookingSummarySidebarProps) {
  return (
    <aside
      aria-label="Ringkasan Reservasi"
      className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl p-5 shadow-xs"
    >
      <h2 className="text-base font-bold text-[#11110F] uppercase tracking-wider pb-3 border-b border-[#D8D4CA]">
        Ringkasan Reservasi
      </h2>

      <dl className="mt-4 space-y-4 divide-y divide-[#D8D4CA]/60 text-sm">
        {/* Service */}
        <div className="pt-3 first:pt-0">
          <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65]">
            <ScissorsIcon size={14} className="text-[#11110F]" />
            Layanan
          </dt>
          <dd className="mt-1">
            {service ? (
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-semibold text-[#11110F]">{service.name}</p>
                  <p className="text-xs text-[#6E6C65]">
                    {service.durationMinutes} menit
                  </p>
                </div>
                <span className="font-bold text-[#11110F]">
                  {formatRupiah(service.priceRupiah)}
                </span>
              </div>
            ) : (
              <span className="text-xs italic text-[#6E6C65]">
                Belum dipilih
              </span>
            )}
          </dd>
        </div>

        {/* Barber */}
        <div className="pt-3">
          <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65]">
            <UserIcon size={14} className="text-[#11110F]" />
            Barber
          </dt>
          <dd className="mt-1">
            {isAnyBarber ? (
              <div>
                <p className="font-semibold text-[#11110F]">
                  Siapa Saja yang Tersedia
                </p>
                <p className="text-xs text-[#2F7D4A]">
                  Penugasan otomatis saat konfirmasi
                </p>
              </div>
            ) : barber ? (
              <div>
                <p className="font-semibold text-[#11110F]">
                  {barber.specialization ?? "Barber Profesional"}
                </p>
                <p className="text-xs text-[#6E6C65]">
                  ID: {barber.id.slice(0, 8)}...
                </p>
              </div>
            ) : (
              <span className="text-xs italic text-[#6E6C65]">
                Belum dipilih
              </span>
            )}
          </dd>
        </div>

        {/* Date */}
        <div className="pt-3">
          <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65]">
            <CalendarIcon size={14} className="text-[#11110F]" />
            Tanggal
          </dt>
          <dd className="mt-1 font-semibold text-[#11110F]">
            {date ? (
              formatDateIndonesian(date)
            ) : (
              <span className="text-xs italic font-normal text-[#6E6C65]">
                Belum dipilih
              </span>
            )}
          </dd>
        </div>

        {/* Time */}
        <div className="pt-3">
          <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65]">
            <ClockIcon size={14} className="text-[#11110F]" />
            Waktu
          </dt>
          <dd className="mt-1">
            {slot ? (
              <div className="font-semibold text-[#11110F]">
                {formatTimeWib(slot.startsAt)} - {formatTimeWib(slot.endsAt)}{" "}
                WIB
              </div>
            ) : (
              <span className="text-xs italic text-[#6E6C65]">
                Belum dipilih
              </span>
            )}
          </dd>
        </div>
      </dl>

      {/* Total Section */}
      <div className="mt-5 pt-4 border-t-2 border-[#11110F] flex justify-between items-baseline">
        <span className="text-xs uppercase font-bold text-[#6E6C65] tracking-wider">
          Estimasi Total
        </span>
        <span className="text-lg font-extrabold text-[#11110F]">
          {service ? formatRupiah(service.priceRupiah) : "—"}
        </span>
      </div>
    </aside>
  );
}
