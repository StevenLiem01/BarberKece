"use client";

import React from "react";
import Link from "next/link";
import {
  BarberScheduleViewerDto,
  ScheduleExceptionDto,
} from "@barberkece/contracts";
import {
  CalendarIcon,
  ClockIcon,
  AlertCircleIcon,
} from "@/components/ui/icons";

interface BarberScheduleViewerProps {
  schedules: BarberScheduleViewerDto[];
  exceptions: ScheduleExceptionDto[];
}

const DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

function formatExceptionDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(d)
      .replace(/\./g, ":");
  } catch {
    return isoString;
  }
}

export function BarberScheduleViewer({
  schedules,
  exceptions,
}: BarberScheduleViewerProps) {
  // Group schedules by dayOfWeek (0 = Minggu, 1 = Senin, ..., 6 = Sabtu)
  const schedulesByDay = DAY_NAMES.map((name, index) => {
    return {
      dayOfWeek: index,
      name,
      periods: schedules
        .filter((s) => s.dayOfWeek === index)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    };
  });

  // Display starting from Monday (1) through Sunday (0)
  const displayDays = [...schedulesByDay.slice(1), schedulesByDay[0]];

  return (
    <div className="space-y-6">
      {/* Workspace Header & Navigation */}
      <header className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-[#C9F23B] text-[#11110F]">
                Jadwal
              </span>
              <span className="text-xs font-semibold text-[#6E6C65]">
                Informasi Jam Kerja & Libur
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#11110F] mt-1">
              Jadwal Saya
            </h1>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
            <Link
              href="/barber"
              className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#11110F] bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl transition-colors hover:bg-[#F3F0E8] hover:border-[#11110F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
            >
              Workspace Hari Ini
            </Link>
            <Link
              href="/barber/appointments"
              className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#11110F] bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl transition-colors hover:bg-[#F3F0E8] hover:border-[#11110F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
            >
              Semua Janji Temu
            </Link>
          </div>
        </div>
      </header>

      {/* Regular Weekly Schedules */}
      <section
        aria-label="Jadwal Reguler Mingguan"
        className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2 pb-2 border-b border-[#D8D4CA]/50">
          <CalendarIcon size={18} className="text-[#6E6C65]" />
          <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-[#11110F]">
            Jadwal Reguler
          </h2>
        </div>

        <div className="divide-y divide-[#D8D4CA]/60">
          {displayDays.map((day) => (
            <div
              key={day.dayOfWeek}
              data-testid={`schedule-day-${day.dayOfWeek}`}
              className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-center gap-3 min-w-[120px]">
                <span className="font-bold text-sm text-[#11110F]">
                  {day.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {day.periods.length > 0 ? (
                  day.periods.map((period) => (
                    <div
                      key={period.id}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#11110F] bg-[#F3F0E8] border border-[#D8D4CA]/60 px-3 py-1.5 rounded-lg"
                    >
                      <ClockIcon
                        size={14}
                        className="text-[#6E6C65] shrink-0"
                      />
                      <span>
                        {period.startTime.slice(0, 5)} -{" "}
                        {period.endTime.slice(0, 5)}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-[#6E6C65] italic">Libur</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Schedule Exceptions */}
      <section
        aria-label="Pengecualian Jadwal"
        className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2 pb-2 border-b border-[#D8D4CA]/50">
          <AlertCircleIcon size={18} className="text-[#6E6C65]" />
          <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-tight text-[#11110F]">
            Pengecualian Jadwal (14 Hari Kedepan)
          </h2>
        </div>

        {exceptions.length > 0 ? (
          <div className="divide-y divide-[#D8D4CA]/60">
            {exceptions
              .sort(
                (a, b) =>
                  new Date(a.startsAt).getTime() -
                  new Date(b.startsAt).getTime(),
              )
              .map((exception) => (
                <div
                  key={exception.id}
                  data-testid={`exception-item-${exception.id}`}
                  className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircleIcon
                      size={18}
                      className="text-[#B63D37] mt-0.5 shrink-0"
                    />
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-[#11110F]">
                        {exception.reason || "Tidak Tersedia"}
                      </p>
                      <div className="text-xs text-[#6E6C65] space-y-0.5">
                        <p>
                          Mulai: {formatExceptionDateTime(exception.startsAt)}{" "}
                          WIB
                        </p>
                        <p>
                          Selesai: {formatExceptionDateTime(exception.endsAt)}{" "}
                          WIB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div
            data-testid="no-exceptions-state"
            className="p-6 bg-[#F3F0E8] border border-[#D8D4CA]/50 rounded-xl text-center"
          >
            <p className="text-xs font-medium text-[#6E6C65]">
              Tidak ada pengecualian jadwal atau libur dalam 14 hari ke depan.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
