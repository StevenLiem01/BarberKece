"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { BarberAppointmentDto } from "@barberkece/contracts";
import { CalendarIcon, AlertCircleIcon, XIcon } from "@/components/ui/icons";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  getJakartaTodayDateString,
  formatJakartaDateIndonesian,
  sortAppointmentsChronologically,
  deriveSpotlightAppointment,
  mapTransitionErrorMessage,
  OperationalAction,
} from "./barber-workspace-helpers";
import { BarberSpotlightCard } from "./barber-spotlight-card";
import { BarberTimelineItem } from "./barber-timeline-item";
import { BarberCancelDialog } from "./barber-cancel-dialog";

export interface BarberTodayWorkspaceProps {
  initialAppointments?: BarberAppointmentDto[];
  initialDate?: string;
  initialNow?: number;
}

export function BarberTodayWorkspace({
  initialAppointments,
  initialDate,
  initialNow,
}: BarberTodayWorkspaceProps) {
  const [date] = useState(() => initialDate ?? getJakartaTodayDateString());
  const [appointments, setAppointments] = useState<BarberAppointmentDto[]>(
    () => initialAppointments ?? [],
  );
  const [isLoading, setIsLoading] = useState(() => !initialAppointments);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Operational action state
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  // Cancellation dialog state
  const [cancelTarget, setCancelTarget] = useState<{
    id: string;
    bookingReference: string;
  } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Race-safety tracking for client fetches
  const fetchCounterRef = useRef(0);

  const fetchAppointments = useCallback(async () => {
    const currentFetchId = ++fetchCounterRef.current;
    setIsLoading(true);
    setFetchError(null);

    try {
      const response = await fetch(
        `/api/v1/barber/appointments?date=${encodeURIComponent(date)}`,
        {
          headers: { Accept: "application/json" },
        },
      );

      // If a newer fetch was started, ignore this response
      if (currentFetchId !== fetchCounterRef.current) {
        return;
      }

      if (!response.ok) {
        let errData;
        try {
          errData = await response.json();
        } catch {
          // non-json error
        }
        const message =
          errData?.error?.message ??
          (response.status === 401 || response.status === 403
            ? "Sesi Anda telah berakhir atau Anda tidak berwenang mengakses workspace ini."
            : "Gagal memuat jadwal hari ini. Silakan periksa koneksi Anda.");
        throw new Error(message);
      }

      const json = await response.json();
      if (currentFetchId === fetchCounterRef.current) {
        setAppointments(json.data ?? []);
      }
    } catch (err) {
      if (currentFetchId === fetchCounterRef.current) {
        setFetchError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memuat jadwal operasional.",
        );
      }
    } finally {
      if (currentFetchId === fetchCounterRef.current) {
        setIsLoading(false);
      }
    }
  }, [date]);

  // Initial fetch on mount if initialAppointments was not provided
  useEffect(() => {
    if (initialAppointments) {
      return;
    }
    let isMounted = true;

    async function loadInitial() {
      try {
        const response = await fetch(
          `/api/v1/barber/appointments?date=${encodeURIComponent(date)}`,
          {
            headers: { Accept: "application/json" },
          },
        );

        if (!isMounted) return;

        if (!response.ok) {
          let errData;
          try {
            errData = await response.json();
          } catch {
            // non-json error
          }
          const message =
            errData?.error?.message ??
            (response.status === 401 || response.status === 403
              ? "Sesi Anda telah berakhir atau Anda tidak berwenang mengakses workspace ini."
              : "Gagal memuat jadwal hari ini. Silakan periksa koneksi Anda.");
          setFetchError(message);
          setIsLoading(false);
          return;
        }

        const json = await response.json();
        if (isMounted) {
          setAppointments(json.data ?? []);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setFetchError(
            err instanceof Error
              ? err.message
              : "Terjadi kesalahan saat memuat jadwal operasional.",
          );
          setIsLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      isMounted = false;
    };
  }, [date, initialAppointments]);

  // Operational status transition mutation (no optimistic updates)
  const handleTransition = async (
    appointmentId: string,
    targetStatus: string,
    cancellationReason?: string,
  ): Promise<boolean> => {
    setMutatingId(appointmentId);
    setActionError(null);

    try {
      const payload: { targetStatus: string; cancellationReason?: string } = {
        targetStatus,
      };
      if (cancellationReason) {
        payload.cancellationReason = cancellationReason;
      }

      const response = await fetch(
        `/api/v1/barber/appointments/${appointmentId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = mapTransitionErrorMessage(
          response.status,
          json?.error,
        );
        setActionError(errorMsg);
        // Do NOT optimistically update state on failure
        return false;
      }

      // Refresh authoritative data from backend
      await fetchAppointments();
      return true;
    } catch {
      setActionError(
        "Gagal terhubung ke server. Periksa koneksi internet Anda dan coba lagi.",
      );
      return false;
    } finally {
      setMutatingId(null);
    }
  };

  const handleAction = (appointmentId: string, action: OperationalAction) => {
    const target = appointments.find((a) => a.id === appointmentId);
    if (!target) return;

    if (action === "CANCEL") {
      setCancelTarget({
        id: target.id,
        bookingReference: target.bookingReference,
      });
      setCancelError(null);
      return;
    }

    if (action === "CHECK_IN") {
      handleTransition(appointmentId, "CHECKED_IN");
      return;
    }

    if (action === "START_SERVICE") {
      handleTransition(appointmentId, "IN_SERVICE");
      return;
    }

    if (action === "COMPLETE") {
      handleTransition(appointmentId, "COMPLETED");
      return;
    }

    if (action === "NO_SHOW") {
      handleTransition(appointmentId, "NO_SHOW");
      return;
    }
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    setCancelError(null);

    const success = await handleTransition(
      cancelTarget.id,
      "CANCELLED_BY_BARBERSHOP",
      reason,
    );

    setIsCancelling(false);
    if (success) {
      setCancelTarget(null);
    } else {
      setCancelError(
        actionError ?? "Gagal membatalkan janji temu karena kendala server.",
      );
    }
  };

  // Derived metrics from authoritative API data
  const totalCount = appointments.length;
  const activeCount = appointments.filter(
    (a) =>
      a.status === "CONFIRMED" ||
      a.status === "CHECKED_IN" ||
      a.status === "IN_SERVICE",
  ).length;
  const completedCount = appointments.filter(
    (a) => a.status === "COMPLETED",
  ).length;
  const cancelledOrNoShowCount = appointments.filter(
    (a) =>
      a.status === "CANCELLED_BY_CUSTOMER" ||
      a.status === "CANCELLED_BY_BARBERSHOP" ||
      a.status === "NO_SHOW",
  ).length;

  const spotlight = deriveSpotlightAppointment(appointments, initialNow);
  const chronologicalAppointments =
    sortAppointmentsChronologically(appointments);

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <header className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-[#C9F23B] text-[#11110F]">
                Hari Ini
              </span>
              <span
                data-testid="workspace-jakarta-date"
                className="text-xs font-semibold text-[#6E6C65]"
              >
                {formatJakartaDateIndonesian(date)}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#11110F] mt-1">
              Workspace Operasional Barber
            </h1>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => fetchAppointments()}
              disabled={isLoading || mutatingId !== null}
              data-testid="refresh-today-btn"
              className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#11110F] bg-[#F3F0E8] border border-[#D8D4CA] rounded-xl transition-colors hover:bg-[#EAE6DC] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] cursor-pointer disabled:opacity-50"
            >
              {isLoading ? "Memuat..." : "Segarkan"}
            </button>
            <LogoutButton />
          </div>
        </div>

        {/* Truthful Summary Metrics from API Data */}
        {!isLoading && !fetchError && totalCount > 0 && (
          <div
            data-testid="truthful-summary-metrics"
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-[#D8D4CA]/50 text-xs"
          >
            <div className="p-2.5 bg-[#F3F0E8] rounded-xl border border-[#D8D4CA]/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6C65] block">
                Total Jadwal
              </span>
              <span
                data-testid="metric-total-count"
                className="font-black text-base text-[#11110F]"
              >
                {totalCount}
              </span>
            </div>
            <div className="p-2.5 bg-[#F3F0E8] rounded-xl border border-[#D8D4CA]/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6C65] block">
                Aktif / Menunggu
              </span>
              <span
                data-testid="metric-active-count"
                className="font-black text-base text-[#11110F]"
              >
                {activeCount}
              </span>
            </div>
            <div className="p-2.5 bg-[#F3F0E8] rounded-xl border border-[#D8D4CA]/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#2F7D4A] block">
                Selesai
              </span>
              <span
                data-testid="metric-completed-count"
                className="font-black text-base text-[#2F7D4A]"
              >
                {completedCount}
              </span>
            </div>
            <div className="p-2.5 bg-[#F3F0E8] rounded-xl border border-[#D8D4CA]/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6C65] block">
                Batal / No-Show
              </span>
              <span
                data-testid="metric-cancelled-count"
                className="font-black text-base text-[#6E6C65]"
              >
                {cancelledOrNoShowCount}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Operational Error Alert Banner (e.g. NO_SHOW rejected before grace period) */}
      {actionError && (
        <div
          role="alert"
          data-testid="action-error-banner"
          className="flex items-start justify-between gap-3 p-4 bg-[#B63D37]/10 border border-[#B63D37]/30 rounded-2xl text-[#B63D37] text-xs font-semibold shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircleIcon size={18} className="shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Tutup pemberitahuan galat"
            className="p-1 hover:bg-[#B63D37]/20 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <XIcon size={16} />
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div
          data-testid="barber-loading-state"
          className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-8 text-center space-y-4 shadow-xs"
        >
          <div className="space-y-3 max-w-sm mx-auto animate-pulse">
            <div className="h-4 bg-[#D8D4CA]/50 rounded-full w-3/4 mx-auto" />
            <div className="h-3 bg-[#D8D4CA]/30 rounded-full w-1/2 mx-auto" />
          </div>
          <p className="text-xs text-[#6E6C65] font-medium">
            Memuat jadwal operasional hari ini...
          </p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && fetchError && (
        <div
          role="alert"
          data-testid="barber-error-state"
          className="bg-[#FAF8F3] border border-[#B63D37]/30 rounded-2xl p-8 text-center space-y-4 shadow-xs"
        >
          <div className="h-12 w-12 rounded-full bg-[#B63D37]/10 text-[#B63D37] flex items-center justify-center mx-auto">
            <AlertCircleIcon size={24} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base font-extrabold uppercase tracking-tight text-[#11110F]">
              Gagal Memuat Jadwal
            </h2>
            <p className="text-xs text-[#6E6C65]">{fetchError}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchAppointments()}
            className="px-5 py-2.5 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !fetchError && appointments.length === 0 && (
        <div
          data-testid="barber-empty-today-state"
          className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-8 sm:p-12 text-center space-y-4 shadow-xs"
        >
          <div className="h-16 w-16 bg-[#11110F]/5 border border-[#D8D4CA] rounded-full flex items-center justify-center mx-auto text-[#11110F]">
            <CalendarIcon size={32} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-extrabold uppercase tracking-tight text-[#11110F]">
              Tidak Ada Janji Temu Hari Ini
            </h2>
            <p className="text-xs sm:text-sm text-[#6E6C65]">
              Anda tidak memiliki jadwal janji temu potong rambut untuk hari
              ini.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchAppointments()}
            className="px-5 py-2.5 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] cursor-pointer"
          >
            Segarkan Jadwal
          </button>
        </div>
      )}

      {/* Main Workspace Content (Spotlight + Chronological Timeline) */}
      {!isLoading && !fetchError && appointments.length > 0 && (
        <div className="space-y-6">
          {/* Active / Next Operational Spotlight */}
          <BarberSpotlightCard
            appointment={spotlight.appointment}
            type={spotlight.type}
            totalAppointmentsToday={totalCount}
            onAction={handleAction}
            isMutating={mutatingId !== null}
          />

          {/* Chronological Timeline Section */}
          <section aria-labelledby="timeline-heading" className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="timeline-heading"
                className="text-sm font-extrabold uppercase tracking-wider text-[#11110F]"
              >
                Jadwal Kronologis Hari Ini ({totalCount})
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {chronologicalAppointments.map((appointment) => (
                <BarberTimelineItem
                  key={appointment.id}
                  appointment={appointment}
                  onAction={handleAction}
                  isMutating={mutatingId === appointment.id}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Barber Cancellation Dialog */}
      {cancelTarget && (
        <BarberCancelDialog
          isOpen={true}
          onClose={() => {
            if (!isCancelling) {
              setCancelTarget(null);
              setCancelError(null);
            }
          }}
          appointmentId={cancelTarget.id}
          bookingReference={cancelTarget.bookingReference}
          isSubmitting={isCancelling}
          errorMessage={cancelError}
          onConfirm={handleCancelConfirm}
        />
      )}
    </div>
  );
}
