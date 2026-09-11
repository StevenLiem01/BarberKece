"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, XIcon, ClockIcon } from "@/components/ui/icons";
import {
  isRescheduleEligible,
  RescheduleAppointmentDialog,
} from "./reschedule-appointment-dialog";

export interface CancelAppointmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  bookingReference: string;
  onSuccess?: () => void;
}

export function isCancellationEligible(status: string): boolean {
  return status === "CONFIRMED";
}

export function mapCancellationErrorMessage(
  status: number,
  errorData?: { code?: string; message?: string },
): string {
  if (status === 401 || status === 403) {
    return "Sesi Anda telah berakhir atau Anda tidak memiliki izin. Silakan masuk kembali.";
  }
  if (status === 404) {
    return "Janji temu tidak ditemukan atau Anda tidak memiliki akses ke data ini.";
  }
  if (status === 400) {
    const msg = (errorData?.message ?? "").toLowerCase();
    if (msg.includes("cutoff")) {
      return "Batas waktu pembatalan mandiri telah terlewati.";
    }
    if (msg.includes("transition") || msg.includes("status")) {
      return "Status janji temu telah berubah dan tidak dapat dibatalkan lagi.";
    }
    return "Permintaan pembatalan tidak dapat diproses. Silakan periksa status jadwal Anda.";
  }
  return "Terjadi kesalahan pada sistem saat membatalkan reservasi. Silakan coba beberapa saat lagi.";
}

export async function executeCancellationRequest(
  appointmentId: string,
  reason: string,
  fetchFn: typeof fetch = fetch,
): Promise<
  | { success: true }
  | { success: false; errorMessage: string; isStaleStatus?: boolean }
> {
  const trimmedReason = reason.trim().slice(0, 500);
  const payload = trimmedReason ? { reason: trimmedReason } : {};

  try {
    const response = await fetchFn(
      `/api/v1/appointments/${appointmentId}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      let errData;
      try {
        errData = await response.json();
      } catch {
        // non-json response
      }
      const message = mapCancellationErrorMessage(
        response.status,
        errData?.error,
      );
      const rawMsg = (errData?.error?.message ?? "").toLowerCase();
      const isStaleStatus =
        response.status === 400 &&
        (rawMsg.includes("transition") || rawMsg.includes("status"));
      return { success: false, errorMessage: message, isStaleStatus };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      errorMessage:
        "Gagal terhubung ke server. Periksa koneksi internet Anda dan coba lagi.",
    };
  }
}

export interface CancelAppointmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  bookingReference: string;
  onSuccess?: () => void;
  onStaleStatus?: () => void;
}

export function CancelAppointmentDialog({
  isOpen,
  onClose,
  appointmentId,
  bookingReference,
  onSuccess,
  onStaleStatus,
}: CancelAppointmentDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const baseId = React.useId();
  const titleId = `${baseId}-cancel-title`;
  const descId = `${baseId}-cancel-desc`;
  const reasonInputId = `${baseId}-cancel-reason`;

  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = React.useCallback(() => {
    if (isSubmitting) return;
    setReason("");
    setErrorMessage(null);
    onClose();
  }, [isSubmitting, onClose]);

  // Focus management and escape listener
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocusedElement =
      document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "Tab" && dialogRef.current) {
        // Focus trap
        const focusableElements =
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          );
        if (focusableElements.length > 0) {
          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement?.focus();
    };
  }, [isOpen, handleClose]);

  if (!isOpen) {
    return null;
  }

  const handleConfirmCancel = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await executeCancellationRequest(appointmentId, reason);

    if (!result.success) {
      setErrorMessage(result.errorMessage);
      setIsSubmitting(false);
      if (result.isStaleStatus && onStaleStatus) {
        onStaleStatus();
      }
      return;
    }

    // Success
    setIsSubmitting(false);
    onClose();
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <div
      data-testid="cancel-appointment-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#11110F]/60 backdrop-blur-xs"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-6 shadow-xl space-y-5 relative"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-[#B63D37]/10 flex items-center justify-center text-[#B63D37] shrink-0">
              <AlertCircleIcon size={20} />
            </div>
            <div>
              <h2
                id={titleId}
                className="text-base font-extrabold uppercase tracking-tight text-[#11110F]"
              >
                Batalkan Janji Temu?
              </h2>
              <p className="text-[11px] font-mono text-[#6E6C65] mt-0.5">
                Ref: {bookingReference}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog"
            className="text-[#6E6C65] hover:text-[#11110F] transition-colors p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#11110F] disabled:opacity-50 cursor-pointer"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Description */}
        <p id={descId} className="text-xs text-[#6E6C65] leading-relaxed">
          Apakah Anda yakin ingin membatalkan jadwal reservasi ini? Tindakan ini
          tidak dapat dibatalkan, dan slot waktu akan dibuka kembali untuk
          pelanggan lain.
        </p>

        {/* Optional Reason Input */}
        <div className="space-y-1.5">
          <label
            htmlFor={reasonInputId}
            className="block text-xs font-bold uppercase tracking-wider text-[#11110F]"
          >
            Alasan Pembatalan{" "}
            <span className="text-[#6E6C65] font-normal lowercase">
              (opsional)
            </span>
          </label>
          <textarea
            id={reasonInputId}
            rows={3}
            maxLength={500}
            disabled={isSubmitting}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Ada keperluan mendadak, perubahan jadwal, dll."
            className="w-full text-xs p-3 bg-[#F3F0E8] border border-[#D8D4CA] rounded-xl text-[#11110F] placeholder-[#6E6C65] focus:outline-none focus:ring-2 focus:ring-[#11110F] focus:bg-[#FAF8F3] transition-colors resize-none disabled:opacity-50"
          />
          <div className="flex justify-end text-[10px] text-[#6E6C65]">
            {reason.length}/500 karakter
          </div>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            data-testid="cancel-error-message"
            className="p-3 bg-[#B63D37]/10 border border-[#B63D37]/30 rounded-xl text-xs text-[#B63D37] flex items-start gap-2"
          >
            <AlertCircleIcon size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#D8D4CA]/60">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#6E6C65] hover:text-[#11110F] transition-colors rounded-xl border border-[#D8D4CA] hover:bg-[#F3F0E8] focus:outline-none focus:ring-2 focus:ring-[#11110F] disabled:opacity-50 cursor-pointer"
          >
            Kembali
          </button>

          <button
            type="button"
            data-testid="confirm-cancel-button"
            onClick={handleConfirmCancel}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#B63D37] text-[#FAF8F3] text-xs font-extrabold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#99312b] focus:outline-none focus:ring-2 focus:ring-[#B63D37] shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <ClockIcon size={14} className="animate-spin" />
                <span>Membatalkan...</span>
              </>
            ) : (
              <span>Ya, Batalkan Reservasi</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface AppointmentDetailActionsProps {
  appointmentId: string;
  bookingReference: string;
  status: string;
  onCancellationSuccess?: () => void;
  // Reschedule coexistence props
  serviceId?: string;
  serviceName?: string;
  barberProfileId?: string | null;
  barberName?: string;
  currentStartsAt?: string;
  currentEndsAt?: string;
  serviceDurationMinutes?: number;
  onRescheduleSuccess?: () => void;
}

export function AppointmentDetailActions({
  appointmentId,
  bookingReference,
  status,
  onCancellationSuccess,
  serviceId,
  serviceName,
  barberProfileId,
  barberName,
  currentStartsAt,
  currentEndsAt,
  serviceDurationMinutes,
  onRescheduleSuccess,
}: AppointmentDetailActionsProps) {
  const router = useRouter();
  const rescheduleButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [isCancelledLocally, setIsCancelledLocally] = useState(false);
  const [isRescheduledLocally, setIsRescheduledLocally] = useState(false);

  // Check eligibility for cancellation and rescheduling
  const canCancel =
    isCancellationEligible(status) &&
    !isCancelledLocally &&
    !isRescheduledLocally;
  const canReschedule =
    isRescheduleEligible(status, barberProfileId) &&
    !isCancelledLocally &&
    !isRescheduledLocally &&
    Boolean(serviceId) &&
    Boolean(currentStartsAt) &&
    Boolean(currentEndsAt);

  if (!canCancel && !canReschedule) {
    if (isCancelledLocally) {
      return (
        <div
          role="status"
          data-testid="cancellation-success-banner"
          className="bg-[#2F7D4A]/10 border border-[#2F7D4A]/30 rounded-2xl p-4 text-center text-xs font-bold text-[#2F7D4A] uppercase tracking-wider"
        >
          Reservasi berhasil dibatalkan. Memperbarui status...
        </div>
      );
    }
    if (isRescheduledLocally) {
      return (
        <div
          role="status"
          data-testid="reschedule-success-banner"
          className="bg-[#2F7D4A]/10 border border-[#2F7D4A]/30 rounded-2xl p-4 text-center text-xs font-bold text-[#2F7D4A] uppercase tracking-wider"
        >
          Jadwal kunjungan berhasil diperbarui. Memperbarui status...
        </div>
      );
    }
    return null;
  }

  const handleCancelSuccess = () => {
    setIsCancelledLocally(true);
    if (onCancellationSuccess) {
      onCancellationSuccess();
    }
    router.refresh();
  };

  const handleRescheduleSuccess = () => {
    setIsRescheduledLocally(true);
    if (onRescheduleSuccess) {
      onRescheduleSuccess();
    }
    router.refresh();
  };

  return (
    <>
      <div
        data-testid="appointment-detail-actions"
        className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3"
      >
        {canReschedule && (
          <button
            ref={rescheduleButtonRef}
            type="button"
            data-testid="reschedule-appointment-button"
            onClick={() => setIsRescheduleDialogOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] shadow-xs cursor-pointer text-center"
          >
            Ubah Jadwal
          </button>
        )}
        {canCancel && (
          <button
            ref={cancelButtonRef}
            type="button"
            data-testid="cancel-appointment-button"
            onClick={() => setIsCancelDialogOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#FAF8F3] border border-[#B63D37]/40 text-[#B63D37] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#B63D37]/10 hover:border-[#B63D37] focus:outline-none focus:ring-2 focus:ring-[#B63D37] shadow-xs cursor-pointer text-center"
          >
            Batalkan Reservasi
          </button>
        )}
      </div>

      {canCancel && (
        <CancelAppointmentDialog
          isOpen={isCancelDialogOpen}
          onClose={() => {
            setIsCancelDialogOpen(false);
            cancelButtonRef.current?.focus();
          }}
          appointmentId={appointmentId}
          bookingReference={bookingReference}
          onSuccess={handleCancelSuccess}
          onStaleStatus={() => router.refresh()}
        />
      )}

      {canReschedule &&
        serviceId &&
        barberProfileId &&
        currentStartsAt &&
        currentEndsAt && (
          <RescheduleAppointmentDialog
            isOpen={isRescheduleDialogOpen}
            onClose={() => setIsRescheduleDialogOpen(false)}
            appointmentId={appointmentId}
            bookingReference={bookingReference}
            serviceId={serviceId}
            serviceName={serviceName ?? "Layanan Potong Rambut"}
            barberProfileId={barberProfileId}
            barberName={barberName ?? "Barber Staff"}
            currentStartsAt={currentStartsAt}
            currentEndsAt={currentEndsAt}
            serviceDurationMinutes={serviceDurationMinutes ?? 45}
            triggerRef={rescheduleButtonRef}
            onSuccess={handleRescheduleSuccess}
            onStaleStatus={() => router.refresh()}
          />
        )}
    </>
  );
}
