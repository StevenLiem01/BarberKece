import React from "react";
import {
  PublicServiceDto,
  PublicBarberDto,
  PublicAvailableSlotDto,
} from "@barberkece/contracts";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CalendarIcon,
  ClockIcon,
  InfoIcon,
  ScissorsIcon,
  UserIcon,
} from "@/components/ui/icons";
import {
  formatRupiah,
  formatTimeWib,
  formatDateIndonesian,
} from "@/lib/format";

export interface ReviewStepProps {
  service: PublicServiceDto;
  barber: PublicBarberDto | null;
  isAnyBarber: boolean;
  date: string;
  slot: PublicAvailableSlotDto;
  notes: string;
  onNotesChange: (notes: string) => void;
  isAuthenticated: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onConfirm: () => void;
  onBack: () => void;
}

export function ReviewStep({
  service,
  barber,
  isAnyBarber,
  date,
  slot,
  notes,
  onNotesChange,
  isAuthenticated,
  isSubmitting,
  submitError,
  onConfirm,
  onBack,
}: ReviewStepProps) {
  const maxNotesLength = 500;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#11110F]">
          Tinjau & Konfirmasi Reservasi
        </h2>
        <p className="text-xs text-[#6E6C65]">
          Periksa detail janji temu Anda sebelum melanjutkan konfirmasi final.
        </p>
      </div>

      {/* Confirmation Error Banner */}
      {submitError && (
        <div
          role="alert"
          className="p-4 border border-[#B63D37]/40 bg-[#B63D37]/10 rounded-xl flex items-start gap-3 text-xs"
        >
          <AlertCircleIcon
            size={18}
            className="text-[#B63D37] shrink-0 mt-0.5"
          />
          <div className="space-y-1">
            <p className="font-bold text-[#B63D37]">Konfirmasi Gagal</p>
            <p className="text-[#11110F]">{submitError}</p>
          </div>
        </div>
      )}

      {/* Detailed Appointment Card */}
      <div className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4 pb-4 border-b border-[#D8D4CA]">
          {/* Service info */}
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-[#11110F] text-[#FAF8F3] flex items-center justify-center shrink-0">
              <ScissorsIcon size={18} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E6C65]">
                Layanan
              </span>
              <p className="text-sm font-bold text-[#11110F]">{service.name}</p>
              <p className="text-xs text-[#6E6C65]">
                {service.durationMinutes} menit —{" "}
                {formatRupiah(service.priceRupiah)}
              </p>
            </div>
          </div>

          {/* Barber info */}
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-[#22231F]/10 text-[#11110F] flex items-center justify-center shrink-0">
              <UserIcon size={18} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E6C65]">
                Barber
              </span>
              <p className="text-sm font-bold text-[#11110F]">
                {isAnyBarber
                  ? "Siapa Saja yang Tersedia"
                  : (barber?.specialization ?? "Barber Profesional")}
              </p>
              <p className="text-xs text-[#6E6C65]">
                {isAnyBarber
                  ? "Penugasan otomatis & adil saat konfirmasi"
                  : `ID: ${barber?.id.slice(0, 8)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Schedule info */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-[#22231F]/10 text-[#11110F] flex items-center justify-center shrink-0">
              <CalendarIcon size={18} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E6C65]">
                Tanggal
              </span>
              <p className="text-sm font-bold text-[#11110F]">
                {formatDateIndonesian(date)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-[#22231F]/10 text-[#11110F] flex items-center justify-center shrink-0">
              <ClockIcon size={18} />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E6C65]">
                Waktu Kedatangan
              </span>
              <p className="text-sm font-bold text-[#11110F]">
                {formatTimeWib(slot.startsAt)} - {formatTimeWib(slot.endsAt)}{" "}
                WIB
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Policy Block */}
      <div className="p-4 bg-[#FAF8F3] border border-[#3E667D]/30 rounded-xl flex items-start gap-3 text-xs text-[#11110F]">
        <InfoIcon size={18} className="text-[#3E667D] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-[#3E667D]">Kebijakan Reservasi</p>
          <p className="text-[#6E6C65]">
            Pembatalan dan perubahan jadwal dapat dilakukan mandiri melalui menu
            Akun hingga <strong>2 jam</strong> sebelum waktu reservasi.
          </p>
        </div>
      </div>

      {/* Notes Input */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label
            htmlFor="reservation-notes"
            className="text-xs font-bold uppercase tracking-wider text-[#6E6C65]"
          >
            Catatan Tambahan (Opsional)
          </label>
          <span className="text-[11px] text-[#6E6C65]">
            {notes.length}/{maxNotesLength}
          </span>
        </div>
        <textarea
          id="reservation-notes"
          rows={3}
          maxLength={maxNotesLength}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Contoh: Tolong cukur tipis di samping, atau rambut bagian atas jangan dipotong terlalu pendek..."
          className="w-full px-3 py-2 text-xs border border-[#D8D4CA] rounded-lg bg-[#FAF8F3] text-[#11110F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] resize-none"
        />
      </div>

      {/* Auth notice for guests */}
      {!isAuthenticated && (
        <div className="p-3 bg-[#FAF8F3] border border-[#D8D4CA] rounded-lg text-xs text-[#6E6C65]">
          <p>
            💡 Anda belum masuk. Saat Anda menekan konfirmasi, draf ini akan
            disimpan dan Anda akan diarahkan ke halaman masuk.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-[#D8D4CA]">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#11110F] hover:text-[#6E6C65] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9F23B] rounded-lg disabled:opacity-40"
        >
          <ArrowLeftIcon size={14} />
          Ubah Waktu
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onConfirm}
          className="px-6 py-3 text-xs font-extrabold uppercase tracking-wider bg-[#11110F] text-[#FAF8F3] rounded-lg transition-colors hover:bg-[#22231F] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#C9F23B] shadow-sm flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="h-3.5 w-3.5 border-2 border-[#FAF8F3] border-t-transparent rounded-full animate-spin" />
              Memproses Reservasi...
            </>
          ) : isAuthenticated ? (
            "Konfirmasi Reservasi"
          ) : (
            "Masuk untuk Konfirmasi Reservasi →"
          )}
        </button>
      </div>
    </div>
  );
}
