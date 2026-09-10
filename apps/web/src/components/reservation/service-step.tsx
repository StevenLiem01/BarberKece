import React from "react";
import { PublicServiceDto } from "@barberkece/contracts";
import { ClockIcon, ScissorsIcon } from "@/components/ui/icons";
import { formatRupiah } from "@/lib/format";

export interface ServiceStepProps {
  services: PublicServiceDto[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedService: PublicServiceDto | null;
  onSelectService: (service: PublicServiceDto) => void;
  onNext: () => void;
}

export function ServiceStep({
  services,
  isLoading,
  error,
  onRetry,
  selectedService,
  onSelectService,
  onNext,
}: ServiceStepProps) {
  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Memuat layanan">
        <div className="h-6 w-48 bg-[#D8D4CA]/40 animate-pulse rounded" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 bg-[#FAF8F3] border border-[#D8D4CA]/50 rounded-xl p-4 animate-pulse"
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

  if (services.length === 0) {
    return (
      <div className="p-8 text-center border border-[#D8D4CA] bg-[#FAF8F3] rounded-xl">
        <ScissorsIcon size={32} className="mx-auto text-[#6E6C65]" />
        <p className="mt-2 text-sm font-semibold text-[#11110F]">
          Tidak ada layanan aktif saat ini
        </p>
        <p className="mt-1 text-xs text-[#6E6C65]">
          Silakan periksa kembali nanti.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#11110F]">Pilih Layanan</h2>
        <p className="text-xs text-[#6E6C65]">
          Pilih jenis perawatan atau potongan rambut yang Anda inginkan.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Pilihan Layanan"
        className="grid gap-3 sm:grid-cols-2"
      >
        {services.map((service) => {
          const isSelected = selectedService?.id === service.id;

          return (
            <div
              key={service.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => onSelectService(service)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onSelectService(service);
                }
              }}
              className={`cursor-pointer rounded-xl p-4 border transition-all relative flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9F23B] ${
                isSelected
                  ? "bg-[#FAF8F3] border-[#11110F] shadow-sm ring-2 ring-[#11110F]"
                  : "bg-[#FAF8F3] border-[#D8D4CA] hover:border-[#6E6C65]"
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-base font-bold text-[#11110F]">
                    {service.name}
                  </h3>
                  <span className="font-extrabold text-sm text-[#11110F] shrink-0">
                    {formatRupiah(service.priceRupiah)}
                  </span>
                </div>
                {service.description && (
                  <p className="mt-1 text-xs text-[#6E6C65] line-clamp-2">
                    {service.description}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-[#D8D4CA]/50 flex items-center justify-between text-xs text-[#6E6C65]">
                <span className="flex items-center gap-1 font-medium">
                  <ClockIcon size={14} />
                  {service.durationMinutes} menit
                </span>
                {isSelected && (
                  <span className="text-[11px] font-bold text-[#2F7D4A] uppercase tracking-wider">
                    Terpilih
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4 border-t border-[#D8D4CA]">
        <button
          type="button"
          disabled={!selectedService}
          onClick={onNext}
          className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider bg-[#11110F] text-[#FAF8F3] rounded-lg transition-colors hover:bg-[#22231F] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
        >
          Lanjutkan ke Pilih Barber →
        </button>
      </div>
    </div>
  );
}
