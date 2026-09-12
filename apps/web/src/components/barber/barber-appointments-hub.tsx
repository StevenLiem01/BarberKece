"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
} from "react";
import Link from "next/link";
import { BarberAppointmentDto } from "@barberkece/contracts";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  ClockIcon,
  ScissorsIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  AlertCircleIcon,
  RefreshIcon,
  FilterIcon,
  InfoIcon,
} from "@/components/ui/icons";
import { formatRupiah, formatTimeWib } from "@/lib/format";
import {
  formatJakartaDateIndonesian,
  sortAppointmentsChronologically,
  jakartaDayStartToIso,
  jakartaDayEndToIso,
} from "./barber-workspace-helpers";

export const CANONICAL_STATUSES = [
  { value: "ALL", label: "Semua Status" },
  { value: "CONFIRMED", label: "Dikonfirmasi" },
  { value: "CHECKED_IN", label: "Check-In" },
  { value: "IN_SERVICE", label: "Sedang Layanan" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "CANCELLED_BY_CUSTOMER", label: "Batal (Pelanggan)" },
  { value: "CANCELLED_BY_BARBERSHOP", label: "Batal (Barbershop)" },
  { value: "NO_SHOW", label: "Tidak Hadir (No Show)" },
] as const;

export type DateFilterMode = "ALL" | "SINGLE" | "RANGE";

export interface BarberAppointmentsHubProps {
  initialAppointments?: BarberAppointmentDto[];
  initialStatusFilter?: string;
  initialDateMode?: DateFilterMode;
  initialSingleDate?: string;
  initialFromDate?: string;
  initialToDate?: string;
  initialError?: string | null;
}

export function BarberAppointmentsHub({
  initialAppointments,
  initialStatusFilter = "ALL",
  initialDateMode = "ALL",
  initialSingleDate = "",
  initialFromDate = "",
  initialToDate = "",
  initialError = null,
}: BarberAppointmentsHubProps = {}) {
  const [, startTransition] = useTransition();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [dateMode, setDateMode] = useState<DateFilterMode>(initialDateMode);
  const [singleDate, setSingleDate] = useState<string>(initialSingleDate);
  const [fromDate, setFromDate] = useState<string>(initialFromDate);
  const [toDate, setToDate] = useState<string>(initialToDate);
  const [dateValidationError, setDateValidationError] = useState<string | null>(
    null,
  );

  // Data & State
  const [appointments, setAppointments] = useState<BarberAppointmentDto[]>(() =>
    sortAppointmentsChronologically(initialAppointments ?? []),
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => !initialAppointments && !initialError,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    () => initialError,
  );

  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();

      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }

      if (dateMode === "SINGLE" && singleDate) {
        params.set("date", singleDate);
      } else if (dateMode === "RANGE") {
        if (fromDate && toDate) {
          if (fromDate > toDate) {
            setDateValidationError(
              "Tanggal awal tidak boleh lebih besar dari tanggal akhir.",
            );
            setIsLoading(false);
            return;
          }
          setDateValidationError(null);
          params.set("from", jakartaDayStartToIso(fromDate));
          params.set("to", jakartaDayEndToIso(toDate));
        } else if (fromDate && !toDate) {
          // If only fromDate is set, query from start of fromDate
          params.set("from", jakartaDayStartToIso(fromDate));
        } else if (!fromDate && toDate) {
          // If only toDate is set, query up to end of toDate
          params.set("to", jakartaDayEndToIso(toDate));
        }
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/api/v1/barber/appointments?${queryString}`
        : "/api/v1/barber/appointments";

      const res = await fetch(endpoint, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.error?.message ||
            `Gagal memuat janji temu (${res.status}).`,
        );
      }

      const json = await res.json();
      const sorted = sortAppointmentsChronologically(json.data || []);
      setAppointments(sorted);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat janji temu.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, dateMode, singleDate, fromDate, toDate]);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialAppointments !== undefined || initialError !== null) {
        return;
      }
    }
    startTransition(() => {
      fetchAppointments();
    });
  }, [fetchAppointments, initialAppointments, initialError]);

  const handleResetFilters = () => {
    setStatusFilter("ALL");
    setDateMode("ALL");
    setSingleDate("");
    setFromDate("");
    setToDate("");
    setDateValidationError(null);
  };

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    dateMode !== "ALL" ||
    singleDate !== "" ||
    fromDate !== "" ||
    toDate !== "";

  return (
    <div className="space-y-6">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D8D4CA] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-widest rounded-full mb-2">
            <span className="w-2 h-2 rounded-full bg-[#C9F23B]" />
            <span>Operasional Barber</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#11110F]">
            Daftar Janji Temu
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6C65]">
            Pantau dan kelola seluruh jadwal serta riwayat janji temu Anda.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/barber"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF8F3] text-[#11110F] text-xs font-bold uppercase tracking-wider border border-[#D8D4CA] rounded-xl hover:border-[#11110F] hover:bg-[#F3F0E8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
          >
            <ArrowLeftIcon size={16} aria-hidden="true" />
            <span>Workspace Hari Ini</span>
          </Link>
          <Link
            href="/barber/schedule"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#FAF8F3] text-[#11110F] text-xs font-bold uppercase tracking-wider border border-[#D8D4CA] rounded-xl hover:border-[#11110F] hover:bg-[#F3F0E8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
          >
            <span>Jadwal Saya</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <section
        aria-label="Filter Janji Temu"
        className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-4 sm:p-6 space-y-4 shadow-xs"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#11110F]">
            <FilterIcon size={16} className="text-[#6E6C65]" />
            <span>Filter Janji Temu</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              data-testid="reset-filters-btn"
              onClick={handleResetFilters}
              className="text-xs font-bold uppercase tracking-wider text-[#6E6C65] hover:text-[#B63D37] transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Filter */}
          <div className="space-y-1.5">
            <label
              htmlFor="status-filter-select"
              className="block text-xs font-bold uppercase tracking-wider text-[#6E6C65]"
            >
              Status Janji Temu
            </label>
            <select
              id="status-filter-select"
              data-testid="status-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl text-xs font-medium text-[#11110F] focus:outline-none focus:border-[#11110F] focus:ring-2 focus:ring-[#C9F23B] transition-all cursor-pointer"
            >
              {CANONICAL_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Mode Filter */}
          <div className="space-y-1.5">
            <label
              htmlFor="date-mode-select"
              className="block text-xs font-bold uppercase tracking-wider text-[#6E6C65]"
            >
              Rentang / Pilihan Tanggal
            </label>
            <select
              id="date-mode-select"
              data-testid="date-mode-select"
              value={dateMode}
              onChange={(e) => {
                const mode = e.target.value as DateFilterMode;
                setDateMode(mode);
                setDateValidationError(null);
              }}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl text-xs font-medium text-[#11110F] focus:outline-none focus:border-[#11110F] focus:ring-2 focus:ring-[#C9F23B] transition-all cursor-pointer"
            >
              <option value="ALL">Semua Tanggal</option>
              <option value="SINGLE">Satu Tanggal Tertentu</option>
              <option value="RANGE">Rentang Tanggal</option>
            </select>
          </div>

          {/* Dynamic Date Inputs based on Date Mode */}
          <div className="space-y-1.5">
            {dateMode === "SINGLE" && (
              <div>
                <label
                  htmlFor="single-date-input"
                  className="block text-xs font-bold uppercase tracking-wider text-[#6E6C65] mb-1.5"
                >
                  Tanggal (WIB)
                </label>
                <input
                  type="date"
                  id="single-date-input"
                  data-testid="single-date-input"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl text-xs font-medium text-[#11110F] focus:outline-none focus:border-[#11110F] focus:ring-2 focus:ring-[#C9F23B] transition-all"
                />
              </div>
            )}

            {dateMode === "RANGE" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="from-date-input"
                    className="block text-xs font-bold uppercase tracking-wider text-[#6E6C65] mb-1.5"
                  >
                    Dari
                  </label>
                  <input
                    type="date"
                    id="from-date-input"
                    data-testid="from-date-input"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setDateValidationError(null);
                    }}
                    className="w-full px-2.5 py-2.5 bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl text-xs font-medium text-[#11110F] focus:outline-none focus:border-[#11110F] focus:ring-2 focus:ring-[#C9F23B] transition-all"
                  />
                </div>
                <div>
                  <label
                    htmlFor="to-date-input"
                    className="block text-xs font-bold uppercase tracking-wider text-[#6E6C65] mb-1.5"
                  >
                    Sampai
                  </label>
                  <input
                    type="date"
                    id="to-date-input"
                    data-testid="to-date-input"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setDateValidationError(null);
                    }}
                    className="w-full px-2.5 py-2.5 bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl text-xs font-medium text-[#11110F] focus:outline-none focus:border-[#11110F] focus:ring-2 focus:ring-[#C9F23B] transition-all"
                  />
                </div>
              </div>
            )}

            {dateMode === "ALL" && (
              <div className="h-full flex items-end">
                <p className="text-xs text-[#6E6C65] italic pb-3">
                  Menampilkan seluruh tanggal yang tercatat.
                </p>
              </div>
            )}
          </div>
        </div>

        {dateValidationError && (
          <div
            role="alert"
            data-testid="date-validation-error"
            className="flex items-center gap-2 p-3 bg-[#B63D37]/10 border border-[#B63D37]/30 text-[#B63D37] text-xs rounded-xl font-medium"
          >
            <AlertCircleIcon size={16} className="shrink-0" />
            <span>{dateValidationError}</span>
          </div>
        )}
      </section>

      {/* Result Summary Bar */}
      {!isLoading && !errorMessage && (
        <div className="flex items-center justify-between text-xs text-[#6E6C65] px-1">
          <span data-testid="results-count">
            Menampilkan{" "}
            <strong className="text-[#11110F] font-bold">
              {appointments.length}
            </strong>{" "}
            janji temu
          </span>
          <button
            type="button"
            onClick={() => fetchAppointments()}
            className="inline-flex items-center gap-1.5 hover:text-[#11110F] transition-colors cursor-pointer"
          >
            <RefreshIcon size={14} />
            <span>Segarkan</span>
          </button>
        </div>
      )}

      {/* Error State */}
      {errorMessage && (
        <div
          role="alert"
          data-testid="hub-error-banner"
          className="p-6 bg-[#B63D37]/10 border border-[#B63D37]/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
        >
          <div className="flex items-center gap-3">
            <AlertCircleIcon size={24} className="text-[#B63D37] shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#B63D37]">
                Gagal Memuat Janji Temu
              </p>
              <p className="text-xs text-[#11110F] mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="hub-retry-btn"
            onClick={() => fetchAppointments()}
            className="px-4 py-2 bg-[#B63D37] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#9a332e] cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading Skeleton State */}
      {isLoading && (
        <div
          role="status"
          aria-label="Memuat daftar janji temu..."
          data-testid="hub-loading-state"
          className="space-y-4"
        >
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-5 sm:p-6 animate-pulse space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-5 w-44 bg-[#D8D4CA]/50 rounded-md" />
                <div className="h-6 w-24 bg-[#D8D4CA]/50 rounded-full" />
              </div>
              <div className="h-4 w-64 bg-[#D8D4CA]/40 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !errorMessage && appointments.length === 0 && (
        <div
          data-testid="hub-empty-state"
          className="bg-[#FAF8F3] border border-dashed border-[#D8D4CA] rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-xs"
        >
          <div className="w-12 h-12 rounded-full bg-[#F3F0E8] border border-[#D8D4CA] mx-auto flex items-center justify-center text-[#6E6C65]">
            <CalendarIcon size={24} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-bold uppercase tracking-wider text-[#11110F]">
              Tidak Ada Janji Temu Ditemukan
            </h2>
            <p className="text-xs text-[#6E6C65]">
              {hasActiveFilters
                ? "Tidak ada janji temu yang cocok dengan filter yang dipilih. Coba sesuaikan tanggal atau status."
                : "Belum ada janji temu yang tercatat di akun barber Anda."}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#22231F] transition-colors cursor-pointer"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      )}

      {/* Appointment List */}
      {!isLoading && !errorMessage && appointments.length > 0 && (
        <div data-testid="hub-appointment-list" className="space-y-3">
          {appointments.map((appointment) => {
            const dateStr = appointment.startsAt.slice(0, 10);

            return (
              <article
                key={appointment.id}
                data-testid={`hub-appointment-item-${appointment.id}`}
                className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-5 sm:p-6 transition-all duration-150 hover:border-[#11110F]/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2.5 min-w-0 flex-1">
                  {/* Top Bar: Date & Status Badge */}
                  <div className="flex items-center justify-between sm:justify-start gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#11110F]">
                      <CalendarIcon
                        size={14}
                        className="text-[#6E6C65] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{formatJakartaDateIndonesian(dateStr)}</span>
                    </div>
                    <Badge status={appointment.status} />
                  </div>

                  {/* Time & Reference */}
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5 text-[#11110F] font-semibold">
                      <ClockIcon
                        size={14}
                        className="text-[#6E6C65] shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        {formatTimeWib(appointment.startsAt)} -{" "}
                        {formatTimeWib(appointment.endsAt)} WIB
                      </span>
                    </div>
                    <span className="text-[#D8D4CA]">•</span>
                    <div className="flex items-center gap-1 text-[#6E6C65]">
                      <span>Ref:</span>
                      <span className="font-mono font-bold text-[#11110F]">
                        #{appointment.bookingReference}
                      </span>
                    </div>
                  </div>

                  {/* Service & Price Snapshots */}
                  <div className="flex items-center gap-2 text-xs text-[#6E6C65]">
                    <ScissorsIcon
                      size={14}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {appointment.serviceDurationMinutes} menit •{" "}
                      <strong className="text-[#11110F] font-bold">
                        {formatRupiah(appointment.priceRupiah)}
                      </strong>
                    </span>
                  </div>

                  {/* Notes Snippet (if any) */}
                  {appointment.notes && (
                    <p className="text-[11px] text-[#6E6C65] line-clamp-1 italic bg-[#F3F0E8] px-2.5 py-1 rounded-lg border border-[#D8D4CA]/50 inline-block max-w-full">
                      Catatan: {appointment.notes}
                    </p>
                  )}

                  {/* Cancellation Reason Snippet (if any) */}
                  {appointment.cancellationReason && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#B63D37] font-medium">
                      <InfoIcon size={12} className="shrink-0" />
                      <span className="line-clamp-1">
                        Batal: {appointment.cancellationReason}
                      </span>
                    </div>
                  )}
                </div>

                {/* Detail Action Link */}
                <div className="sm:shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#D8D4CA]/50 flex justify-end">
                  <Link
                    href={`/barber/appointments/${appointment.id}`}
                    data-testid={`view-detail-link-${appointment.id}`}
                    aria-label={`Lihat detail janji temu #${appointment.bookingReference}`}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
                  >
                    <span>Detail</span>
                    <ArrowRightIcon size={14} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
