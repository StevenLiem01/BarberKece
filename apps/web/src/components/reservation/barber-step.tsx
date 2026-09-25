import React from "react";
import { PublicBarberDto } from "@barberkece/contracts";
import { ArrowLeftIcon, UserIcon } from "@/components/ui/icons";

export interface BarberStepProps {
  barbers: PublicBarberDto[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedBarber: PublicBarberDto | null;
  isAnyBarber: boolean;
  onSelectAnyBarber: () => void;
  onSelectSpecificBarber: (barber: PublicBarberDto) => void;
  onBack: () => void;
  onNext: () => void;
}

export function BarberStep({
  barbers,
  isLoading,
  error,
  onRetry,
  selectedBarber,
  isAnyBarber,
  onSelectAnyBarber,
  onSelectSpecificBarber,
  onBack,
  onNext,
}: BarberStepProps) {
  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Memuat barber">
        <div className="h-6 w-48 bg-[#D8D4CA]/40 animate-pulse rounded" />
        <div className="h-24 bg-[#FAF8F3] border border-[#D8D4CA]/50 rounded-xl p-4 animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-24 bg-[#FAF8F3] border border-[#D8D4CA]/50 rounded-xl p-4 animate-pulse"
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

  const isSelectionMade = isAnyBarber || selectedBarber !== null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#11110F]">Preferensi Barber</h2>
        <p className="text-xs text-[#6E6C65]">
          Pilih barber favorit Anda atau biarkan sistem menugaskan barber yang
          tersedia.
        </p>
      </div>

      <div role="radiogroup" aria-label="Pilihan Barber" className="space-y-3">
        {/* Option 1: Any Available */}
        <div
          role="radio"
          aria-checked={isAnyBarber}
          tabIndex={0}
          onClick={onSelectAnyBarber}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              onSelectAnyBarber();
            }
          }}
          className={`cursor-pointer rounded-xl p-4 border transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9F23B] ${
            isAnyBarber
              ? "bg-[#FAF8F3] border-[#11110F] shadow-sm ring-2 ring-[#11110F]"
              : "bg-[#FAF8F3] border-[#D8D4CA] hover:border-[#6E6C65]"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[#C9F23B]/30 flex items-center justify-center shrink-0 text-[#11110F]">
                <UserIcon size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#11110F]">
                    Siapa Saja yang Tersedia
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-[#C9F23B] text-[#11110F] rounded">
                    Rekomendasi
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#6E6C65]">
                  Paling fleksibel dengan pilihan waktu terbanyak. Barber
                  kompeten akan ditugaskan secara otomatis.
                </p>
              </div>
            </div>
            {isAnyBarber && (
              <span className="text-xs font-bold text-[#2F7D4A] uppercase tracking-wider shrink-0">
                Terpilih
              </span>
            )}
          </div>
        </div>

        {/* Section: Specific Barbers */}
        {barbers.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#6E6C65] mb-2">
              Atau Pilih Barber Khusus:
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {barbers.map((barber) => {
                const isSelected =
                  !isAnyBarber && selectedBarber?.id === barber.id;

                return (
                  <div
                    key={barber.id}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => onSelectSpecificBarber(barber)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        onSelectSpecificBarber(barber);
                      }
                    }}
                    className={`cursor-pointer rounded-xl p-4 border transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9F23B] ${
                      isSelected
                        ? "bg-[#FAF8F3] border-[#11110F] shadow-sm ring-2 ring-[#11110F]"
                        : "bg-[#FAF8F3] border-[#D8D4CA] hover:border-[#6E6C65]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#D8D4CA]/50 flex items-center justify-center shrink-0 text-[#22231F]">
                          <UserIcon size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#11110F]">
                            {barber.displayName}
                          </h3>
                          {barber.specialization && (
                            <p className="text-[11px] text-[#6E6C65]">
                              {barber.specialization}
                            </p>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-xs font-bold text-[#2F7D4A] uppercase tracking-wider shrink-0">
                          Terpilih
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
          disabled={!isSelectionMade}
          onClick={onNext}
          className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider bg-[#11110F] text-[#FAF8F3] rounded-lg transition-colors hover:bg-[#22231F] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
        >
          Lanjutkan ke Pilih Tanggal →
        </button>
      </div>
    </div>
  );
}
