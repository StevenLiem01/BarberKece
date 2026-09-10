import React from "react";
import { PublicAvailableSlotDto } from "@barberkece/contracts";
import { ArrowLeftIcon, ClockIcon } from "@/components/ui/icons";
import { formatTimeWib } from "@/lib/format";

export interface TimeStepProps {
  slots: PublicAvailableSlotDto[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedSlot: PublicAvailableSlotDto | null;
  onSelectSlot: (slot: PublicAvailableSlotDto) => void;
  isSpecificBarber: boolean;
  onSwitchToAnyBarber: () => void;
  onChangeDate: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function TimeStep({
  slots,
  isLoading,
  error,
  onRetry,
  selectedSlot,
  onSelectSlot,
  isSpecificBarber,
  onSwitchToAnyBarber,
  onChangeDate,
  onBack,
  onNext,
}: TimeStepProps) {
  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Memuat slot waktu">
        <div className="h-6 w-48 bg-[#D8D4CA]/40 animate-pulse rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-14 bg-[#FAF8F3] border border-[#D8D4CA]/50 rounded-xl p-3 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center border border-[#B63D37]/30 bg-[#B63D37]/10 rounded-xl">
        <p className="text-sm text-[#B63D37] font-semibold">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#11110F] text-[#FAF8F3] rounded-lg hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="p-6 text-center border border-[#D8D4CA] bg-[#FAF8F3] rounded-xl space-y-4">
        <div className="h-12 w-12 rounded-full bg-[#D8D4CA]/40 flex items-center justify-center mx-auto text-[#6E6C65]">
          <ClockIcon size={24} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#11110F]">
            Tidak Ada Slot Tersedia
          </h3>
          <p className="mt-1 text-xs text-[#6E6C65] max-w-sm mx-auto">
            {isSpecificBarber
              ? "Barber pilihan Anda tidak memiliki jadwal luang pada tanggal ini."
              : "Semua slot pada tanggal ini sudah terisi penuh atau barbershop tutup."}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {isSpecificBarber && (
            <button
              type="button"
              onClick={onSwitchToAnyBarber}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#C9F23B] text-[#11110F] rounded-lg transition-colors hover:bg-[#b4db29] focus:outline-none focus:ring-2 focus:ring-[#11110F]"
            >
              Cari Siapa Saja yang Tersedia
            </button>
          )}
          <button
            type="button"
            onClick={onChangeDate}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-[#FAF8F3] border border-[#D8D4CA] text-[#11110F] rounded-lg transition-colors hover:bg-[#D8D4CA]/30 focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
          >
            Ubah Tanggal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#11110F]">Pilih Waktu</h2>
        <p className="text-xs text-[#6E6C65]">
          Pilih jam kedatangan yang paling sesuai dengan jadwal Anda.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Pilihan Waktu Tersedia"
        className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto p-1"
      >
        {slots.map((slot) => {
          const isSelected = selectedSlot?.startsAt === slot.startsAt;
          const startFormatted = formatTimeWib(slot.startsAt);
          const endFormatted = formatTimeWib(slot.endsAt);

          return (
            <button
              key={slot.startsAt}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectSlot(slot)}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9F23B] ${
                isSelected
                  ? "bg-[#11110F] text-[#FAF8F3] border-[#11110F] shadow-sm ring-2 ring-[#C9F23B]"
                  : "bg-[#FAF8F3] text-[#11110F] border-[#D8D4CA] hover:border-[#11110F]"
              }`}
            >
              <span className="text-base font-extrabold tracking-tight">
                {startFormatted}
              </span>
              <span
                className={`text-[11px] ${
                  isSelected ? "text-[#C9F23B]" : "text-[#6E6C65]"
                }`}
              >
                s.d. {endFormatted} WIB
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[#D8D4CA]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#11110F] hover:text-[#6E6C65] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9F23B] rounded-lg"
        >
          <ArrowLeftIcon size={14} />
          Kembali
        </button>
        <button
          type="button"
          disabled={!selectedSlot}
          onClick={onNext}
          className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider bg-[#11110F] text-[#FAF8F3] rounded-lg transition-colors hover:bg-[#22231F] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
        >
          Lanjutkan ke Ringkasan →
        </button>
      </div>
    </div>
  );
}
