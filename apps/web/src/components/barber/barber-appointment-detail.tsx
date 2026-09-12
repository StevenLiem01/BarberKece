"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
} from "react";
import Link from "next/link";
import {
  BarberAppointmentDto,
  BarberOperationalTargetStatus,
} from "@barberkece/contracts";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  ClockIcon,
  ScissorsIcon,
  ArrowLeftIcon,
  AlertCircleIcon,
  InfoIcon,
} from "@/components/ui/icons";
import { formatRupiah, formatTimeWib } from "@/lib/format";
import {
  formatJakartaDateIndonesian,
  getAllowedTargetStatuses,
  mapTransitionErrorMessage,
} from "./barber-workspace-helpers";
import { BarberCancelDialog } from "./barber-cancel-dialog";

export interface BarberAppointmentDetailProps {
  appointmentId: string;
  initialAppointment?: BarberAppointmentDto | null;
  initialNotFound?: boolean;
  initialError?: string | null;
}

export function BarberAppointmentDetail({
  appointmentId,
  initialAppointment,
  initialNotFound = false,
  initialError = null,
}: BarberAppointmentDetailProps) {
  const [, startTransition] = useTransition();

  // Data & State
  const [appointment, setAppointment] = useState<BarberAppointmentDto | null>(
    () => initialAppointment ?? null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => !initialAppointment && !initialNotFound && !initialError,
  );
  const [notFound, setNotFound] = useState<boolean>(() => initialNotFound);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    () => initialError,
  );

  // Operational Mutation State
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState<boolean>(false);

  const fetchDetail = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setNotFound(false);

    try {
      const res = await fetch(`/api/v1/barber/appointments/${appointmentId}`, {
        headers: { Accept: "application/json" },
      });

      if (res.status === 404) {
        setNotFound(true);
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.error?.message ||
            `Gagal memuat detail janji temu (${res.status}).`,
        );
      }

      const json = await res.json();
      setAppointment(json.data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat detail janji temu.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId]);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialAppointment || initialNotFound || initialError) {
        return;
      }
    }
    startTransition(() => {
      fetchDetail();
    });
  }, [fetchDetail, initialAppointment, initialNotFound, initialError]);

  const handleTransition = async (
    targetStatus: BarberOperationalTargetStatus,
    cancellationReason?: string,
  ) => {
    if (isMutating) return;
    setIsMutating(true);
    setMutationError(null);

    try {
      const payload: {
        targetStatus: BarberOperationalTargetStatus;
        cancellationReason?: string;
      } = { targetStatus };

      if (cancellationReason !== undefined) {
        payload.cancellationReason = cancellationReason;
      }

      const res = await fetch(
        `/api/v1/barber/appointments/${appointmentId}/transition`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const resJson = await res.json().catch(() => null);

      if (!res.ok) {
        const mappedError = mapTransitionErrorMessage(
          res.status,
          resJson?.error,
        );
        setMutationError(mappedError);
        return;
      }

      // Close cancel dialog if open
      setIsCancelDialogOpen(false);

      // Re-fetch authoritative detail from server
      await fetchDetail();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan jaringan saat memproses aksi operasional.";
      setMutationError(msg);
    } finally {
      setIsMutating(false);
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Memuat detail janji temu..."
        data-testid="detail-loading-state"
        className="max-w-2xl mx-auto space-y-6"
      >
        <div className="h-6 w-48 bg-[#D8D4CA]/50 rounded-md animate-pulse" />
        <div className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-6 sm:p-8 space-y-4 animate-pulse">
          <div className="h-7 w-32 bg-[#D8D4CA]/50 rounded-full mx-auto" />
          <div className="h-8 w-64 bg-[#D8D4CA]/50 rounded-md mx-auto" />
          <div className="h-16 w-48 bg-[#D8D4CA]/40 rounded-xl mx-auto" />
        </div>
        <div className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-6 sm:p-8 space-y-4 animate-pulse">
          <div className="h-5 w-40 bg-[#D8D4CA]/50 rounded-md" />
          <div className="space-y-3 pt-4">
            <div className="h-4 w-full bg-[#D8D4CA]/40 rounded-md" />
            <div className="h-4 w-full bg-[#D8D4CA]/40 rounded-md" />
            <div className="h-4 w-3/4 bg-[#D8D4CA]/40 rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  // Not Found State (IDOR Safe: same generic message without distinguishing ownership)
  if (notFound) {
    return (
      <div
        data-testid="detail-not-found"
        className="max-w-md mx-auto bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-8 text-center space-y-5 shadow-xs"
      >
        <div className="w-12 h-12 rounded-full bg-[#F3F0E8] border border-[#D8D4CA] mx-auto flex items-center justify-center text-[#6E6C65]">
          <AlertCircleIcon size={24} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold uppercase tracking-tight text-[#11110F]">
            Janji Temu Tidak Ditemukan
          </h1>
          <p className="text-xs text-[#6E6C65]">Janji temu tidak ditemukan.</p>
        </div>
        <div>
          <Link
            href="/barber/appointments"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#22231F] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
          >
            <ArrowLeftIcon size={16} aria-hidden="true" />
            <span>Kembali ke Daftar Janji Temu</span>
          </Link>
        </div>
      </div>
    );
  }

  // Generic Error State
  if (errorMessage || !appointment) {
    return (
      <div
        role="alert"
        data-testid="detail-error-banner"
        className="max-w-md mx-auto bg-[#FAF8F3] border border-[#B63D37]/30 rounded-2xl p-8 text-center space-y-5 shadow-xs"
      >
        <div className="w-12 h-12 rounded-full bg-[#B63D37]/10 text-[#B63D37] mx-auto flex items-center justify-center">
          <AlertCircleIcon size={24} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold uppercase tracking-tight text-[#B63D37]">
            Gagal Memuat Detail
          </h1>
          <p className="text-xs text-[#11110F]">{errorMessage}</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/barber/appointments"
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6E6C65] hover:text-[#11110F] border border-[#D8D4CA] rounded-xl transition-colors"
          >
            Daftar Janji Temu
          </Link>
          <button
            type="button"
            data-testid="detail-retry-btn"
            onClick={() => fetchDetail()}
            className="px-4 py-2 bg-[#B63D37] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#9a332e] cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const allowedStatuses = getAllowedTargetStatuses(appointment.status);
  const dateStr = appointment.startsAt.slice(0, 10);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Navigation */}
      <div>
        <Link
          href="/barber/appointments"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6E6C65] hover:text-[#11110F] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9F23B] rounded-lg p-1"
        >
          <ArrowLeftIcon size={16} aria-hidden="true" />
          <span>Kembali ke Daftar Janji Temu</span>
        </Link>
      </div>

      {/* Mutation Error Banner */}
      {mutationError && (
        <div
          role="alert"
          data-testid="mutation-error-banner"
          className="p-4 bg-[#B63D37]/10 border border-[#B63D37]/30 rounded-2xl flex items-start gap-3 text-xs text-[#B63D37] font-medium"
        >
          <AlertCircleIcon size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Gagal memperbarui status:</span>{" "}
            {mutationError}
          </div>
          <button
            type="button"
            onClick={() => setMutationError(null)}
            className="text-[#6E6C65] hover:text-[#11110F] font-bold text-xs cursor-pointer ml-2"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header Receipt Card */}
      <div className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-6 sm:p-8 text-center shadow-xs space-y-4">
        <div className="flex justify-center">
          <Badge status={appointment.status} />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#11110F]">
            Detail Janji Temu
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6E6C65]">
            Informasi lengkap dan tindakan operasional barber.
          </p>
        </div>

        {/* Booking Reference Box */}
        <div className="p-4 bg-[#F3F0E8] border border-[#D8D4CA] rounded-xl inline-block max-w-full">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E6C65]">
            Kode Reservasi
          </p>
          <p
            data-testid="detail-booking-reference"
            className="text-xl sm:text-2xl font-black uppercase tracking-widest text-[#11110F] mt-0.5"
          >
            #{appointment.bookingReference}
          </p>
        </div>
      </div>

      {/* Detailed Information Card */}
      <div className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-6 sm:p-8 shadow-xs">
        <h2 className="text-base font-bold uppercase tracking-wider text-[#11110F] pb-3 border-b border-[#D8D4CA]">
          Rincian Jadwal & Layanan
        </h2>

        <dl className="mt-4 space-y-4 divide-y divide-[#D8D4CA]/60 text-sm">
          {/* Tanggal */}
          <div className="pt-3 first:pt-0 flex justify-between items-start gap-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
              <CalendarIcon size={16} className="text-[#11110F]" />
              Tanggal
            </dt>
            <dd
              data-testid="detail-date"
              className="font-bold text-[#11110F] text-right"
            >
              {formatJakartaDateIndonesian(dateStr)}
            </dd>
          </div>

          {/* Waktu */}
          <div className="pt-3 flex justify-between items-start gap-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
              <ClockIcon size={16} className="text-[#11110F]" />
              Waktu Layanan
            </dt>
            <dd
              data-testid="detail-time"
              className="font-bold text-[#11110F] text-right"
            >
              {formatTimeWib(appointment.startsAt)} -{" "}
              {formatTimeWib(appointment.endsAt)} WIB
            </dd>
          </div>

          {/* Durasi Layanan */}
          <div className="pt-3 flex justify-between items-start gap-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
              <ScissorsIcon size={16} className="text-[#11110F]" />
              Durasi
            </dt>
            <dd
              data-testid="detail-duration"
              className="font-bold text-[#11110F] text-right"
            >
              {appointment.serviceDurationMinutes} menit
            </dd>
          </div>

          {/* Catatan (if present) */}
          {appointment.notes && (
            <div className="pt-3 flex justify-between items-start gap-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
                Catatan Pelanggan
              </dt>
              <dd
                data-testid="detail-notes"
                className="text-right text-xs text-[#11110F] italic max-w-xs"
              >
                &ldquo;{appointment.notes}&rdquo;
              </dd>
            </div>
          )}

          {/* Alasan Pembatalan (if present) */}
          {appointment.cancellationReason && (
            <div className="pt-3 flex justify-between items-start gap-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#B63D37] shrink-0">
                Alasan Pembatalan
              </dt>
              <dd
                data-testid="detail-cancellation-reason"
                className="text-right text-xs text-[#B63D37] max-w-xs font-medium"
              >
                {appointment.cancellationReason}
              </dd>
            </div>
          )}

          {/* Price Snapshot */}
          <div className="pt-4 flex justify-between items-baseline gap-4 border-t-2 border-[#11110F]">
            <dt className="text-xs font-extrabold uppercase tracking-wider text-[#11110F]">
              Total Biaya Layanan
            </dt>
            <dd
              data-testid="detail-price"
              className="text-xl font-black text-[#11110F]"
            >
              {formatRupiah(appointment.priceRupiah)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Operational Action Card */}
      <div
        data-testid="operational-actions-card"
        className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4"
      >
        <h2 className="text-base font-bold uppercase tracking-wider text-[#11110F] pb-3 border-b border-[#D8D4CA]">
          Tindakan Operasional
        </h2>

        {/* Action Controls for Non-Terminal Statuses */}
        {allowedStatuses.length > 0 && (
          <div className="flex items-center justify-end gap-3 flex-wrap pt-2">
            {allowedStatuses.includes("CHECKED_IN") && (
              <button
                type="button"
                disabled={isMutating}
                data-testid="detail-check-in-btn"
                onClick={() => handleTransition("CHECKED_IN")}
                className="px-4 py-2.5 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] cursor-pointer disabled:opacity-50"
              >
                {isMutating ? "Memproses..." : "Check-In"}
              </button>
            )}

            {allowedStatuses.includes("IN_SERVICE") && (
              <button
                type="button"
                disabled={isMutating}
                data-testid="detail-start-service-btn"
                onClick={() => handleTransition("IN_SERVICE")}
                className="px-4 py-2.5 bg-[#C9F23B] text-[#11110F] text-xs font-extrabold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#b5dc30] focus:outline-none focus:ring-2 focus:ring-[#11110F] cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isMutating ? "Memproses..." : "Mulai Layanan"}
              </button>
            )}

            {allowedStatuses.includes("COMPLETED") && (
              <button
                type="button"
                disabled={isMutating}
                data-testid="detail-complete-btn"
                onClick={() => handleTransition("COMPLETED")}
                className="px-4 py-2.5 bg-[#2F7D4A] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#27663d] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] cursor-pointer disabled:opacity-50"
              >
                {isMutating ? "Memproses..." : "Selesaikan Layanan"}
              </button>
            )}

            {allowedStatuses.includes("NO_SHOW") && (
              <button
                type="button"
                disabled={isMutating}
                data-testid="detail-no-show-btn"
                onClick={() => handleTransition("NO_SHOW")}
                className="px-4 py-2.5 border border-[#A66A16]/50 text-[#A66A16] hover:bg-[#A66A16]/10 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#A66A16] cursor-pointer disabled:opacity-50"
              >
                {isMutating ? "Memproses..." : "Tidak Hadir (No Show)"}
              </button>
            )}

            {allowedStatuses.includes("CANCELLED_BY_BARBERSHOP") && (
              <button
                type="button"
                disabled={isMutating}
                data-testid="detail-cancel-btn"
                onClick={() => setIsCancelDialogOpen(true)}
                className="px-4 py-2.5 border border-[#B63D37]/40 text-[#B63D37] hover:bg-[#B63D37]/10 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-[#B63D37] cursor-pointer disabled:opacity-50"
              >
                Batalkan Janji Temu
              </button>
            )}
          </div>
        )}

        {/* Notice for Terminal Statuses */}
        {allowedStatuses.length === 0 && (
          <div
            data-testid="detail-terminal-notice"
            className="p-4 bg-[#F3F0E8] border border-[#D8D4CA] rounded-xl text-xs text-[#6E6C65] flex items-center gap-2.5"
          >
            <InfoIcon size={16} className="shrink-0 text-[#11110F]" />
            <span>
              Janji temu ini telah berstatus terminal ({appointment.status}).
              Tidak ada tindakan operasional lebih lanjut yang diperlukan.
            </span>
          </div>
        )}
      </div>

      {/* Reusable Barber Cancel Dialog */}
      <BarberCancelDialog
        isOpen={isCancelDialogOpen}
        onClose={() => {
          if (!isMutating) {
            setIsCancelDialogOpen(false);
          }
        }}
        appointmentId={appointment.id}
        bookingReference={appointment.bookingReference}
        isSubmitting={isMutating}
        errorMessage={mutationError}
        onConfirm={(reason) =>
          handleTransition("CANCELLED_BY_BARBERSHOP", reason)
        }
      />
    </div>
  );
}
