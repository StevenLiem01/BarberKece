import React, { useMemo } from "react";
import { ArrowLeftIcon, CalendarIcon } from "@/components/ui/icons";
import { formatDateIndonesian } from "@/lib/format";

export interface DateStepProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onBack: () => void;
  onNext: () => void;
  bookingHorizonDays?: number;
}

export function DateStep({
  selectedDate,
  onSelectDate,
  onBack,
  onNext,
  bookingHorizonDays = 30,
}: DateStepProps) {
  // Generate selectable dates within booking horizon
  const { dates, minDate, maxDate } = useMemo(() => {
    const list: {
      dateStr: string;
      dayName: string;
      dayNumber: number;
      monthName: string;
      isToday: boolean;
    }[] = [];

    // Anchor start date to Asia/Jakarta calendar day
    const jakartaTodayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const [jYear, jMonth, jDay] = jakartaTodayStr.split("-").map(Number);
    const startAnchor = new Date(jYear, jMonth - 1, jDay);

    let min = "";
    let max = "";

    for (let i = 0; i < bookingHorizonDays; i++) {
      const d = new Date(
        startAnchor.getFullYear(),
        startAnchor.getMonth(),
        startAnchor.getDate() + i,
      );
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      if (i === 0) min = dateStr;
      if (i === bookingHorizonDays - 1) max = dateStr;

      const dayName = new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
      }).format(d);
      const monthName = new Intl.DateTimeFormat("id-ID", {
        month: "short",
      }).format(d);

      list.push({
        dateStr,
        dayName,
        dayNumber: d.getDate(),
        monthName,
        isToday: i === 0,
      });
    }

    return { dates: list, minDate: min, maxDate: max };
  }, [bookingHorizonDays]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#11110F]">Pilih Tanggal</h2>
        <p className="text-xs text-[#6E6C65]">
          Pilih hari kunjungan Anda (reservasi tersedia hingga{" "}
          {bookingHorizonDays} hari ke depan).
        </p>
      </div>

      {/* Quick Select Horizon Grid */}
      <div>
        <div
          role="radiogroup"
          aria-label="Pilihan Tanggal Cepat"
          className="grid grid-cols-4 sm:grid-cols-7 gap-2 max-h-72 overflow-y-auto p-1"
        >
          {dates.map((item) => {
            const isSelected = selectedDate === item.dateStr;

            return (
              <button
                key={item.dateStr}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelectDate(item.dateStr)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9F23B] ${
                  isSelected
                    ? "bg-[#11110F] text-[#FAF8F3] border-[#11110F] shadow-sm ring-2 ring-[#C9F23B]"
                    : "bg-[#FAF8F3] text-[#11110F] border-[#D8D4CA] hover:border-[#11110F]"
                }`}
              >
                <span
                  className={`text-[10px] font-semibold uppercase ${
                    isSelected ? "text-[#C9F23B]" : "text-[#6E6C65]"
                  }`}
                >
                  {item.isToday ? "Hari ini" : item.dayName}
                </span>
                <span className="text-base font-extrabold my-0.5">
                  {item.dayNumber}
                </span>
                <span
                  className={`text-[10px] ${
                    isSelected ? "text-[#FAF8F3]/80" : "text-[#6E6C65]"
                  }`}
                >
                  {item.monthName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Or manual HTML date input */}
      <div className="pt-2">
        <label
          htmlFor="date-picker-input"
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#6E6C65] mb-1.5"
        >
          <CalendarIcon size={14} />
          Atau Pilih Tanggal Melalui Kalender:
        </label>
        <input
          id="date-picker-input"
          type="date"
          min={minDate}
          max={maxDate}
          value={selectedDate ?? ""}
          onChange={(e) => {
            if (e.target.value) {
              onSelectDate(e.target.value);
            }
          }}
          className="w-full sm:w-auto px-4 py-2 border border-[#D8D4CA] rounded-lg bg-[#FAF8F3] text-[#11110F] font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
        />
      </div>

      {/* Selected date confirmation alert */}
      {selectedDate && (
        <div className="p-3 bg-[#FAF8F3] border border-[#2F7D4A]/30 rounded-lg flex items-center justify-between text-xs">
          <span className="text-[#6E6C65]">Tanggal Terpilih:</span>
          <span className="font-bold text-[#11110F]">
            {formatDateIndonesian(selectedDate)}
          </span>
        </div>
      )}

      {/* Navigation buttons */}
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
          disabled={!selectedDate}
          onClick={onNext}
          className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider bg-[#11110F] text-[#FAF8F3] rounded-lg transition-colors hover:bg-[#22231F] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
        >
          Lanjutkan ke Pilih Waktu →
        </button>
      </div>
    </div>
  );
}
