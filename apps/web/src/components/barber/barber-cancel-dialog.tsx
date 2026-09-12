"use client";

import React, { useState, useEffect, useRef } from "react";
import { AlertCircleIcon, XIcon } from "@/components/ui/icons";

export interface BarberCancelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  bookingReference: string;
  isSubmitting?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
  errorMessage?: string | null;
}

export function BarberCancelDialog({
  isOpen,
  onClose,
  appointmentId,
  bookingReference,
  isSubmitting = false,
  onConfirm,
  errorMessage,
}: BarberCancelDialogProps) {
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || isSubmitting) return;
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError("Alasan pembatalan wajib diisi.");
      textareaRef.current?.focus();
      return;
    }
    setValidationError(null);
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#11110F]/70 backdrop-blur-xs"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="barber-cancel-title"
        aria-describedby="barber-cancel-desc"
        className="w-full max-w-md bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="barber-cancel-title"
              className="text-lg font-extrabold uppercase tracking-tight text-[#11110F]"
            >
              Batalkan Janji Temu
            </h2>
            <p id="barber-cancel-desc" className="text-xs text-[#6E6C65] mt-1">
              Reservasi{" "}
              <span className="font-mono font-bold text-[#11110F]">
                #{bookingReference}
              </span>{" "}
              akan dibatalkan oleh pihak barbershop. Tindakan ini tidak dapat
              dibatalkan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog"
            className="p-1.5 text-[#6E6C65] hover:text-[#11110F] hover:bg-[#D8D4CA]/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Backend Error Banner if any */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-xl bg-[#B63D37]/10 border border-[#B63D37]/30 text-[#B63D37] text-xs font-medium"
          >
            <AlertCircleIcon size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="cancellation-reason-input"
              className="block text-xs font-bold uppercase tracking-wider text-[#11110F]"
            >
              Alasan Pembatalan <span className="text-[#B63D37]">*</span>
            </label>
            <textarea
              id="cancellation-reason-input"
              ref={textareaRef}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationError && e.target.value.trim()) {
                  setValidationError(null);
                }
              }}
              rows={3}
              maxLength={500}
              placeholder="Contoh: Terjadi kendala operasional mendadak / Barber berhalangan hadir"
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 bg-[#FAF8F3] border border-[#D8D4CA] rounded-xl text-xs text-[#11110F] placeholder-[#6E6C65]/60 focus:outline-none focus:border-[#11110F] focus:ring-2 focus:ring-[#C9F23B] transition-all disabled:opacity-50 resize-none"
            />
            <div className="flex items-center justify-between text-[11px]">
              {validationError ? (
                <span role="alert" className="text-[#B63D37] font-semibold">
                  {validationError}
                </span>
              ) : (
                <span className="text-[#6E6C65]">Wajib diisi</span>
              )}
              <span className="text-[#6E6C65] font-mono">
                {reason.length}/500
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6E6C65] hover:text-[#11110F] border border-[#D8D4CA] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid={`confirm-cancel-btn-${appointmentId}`}
              className="px-4 py-2 bg-[#B63D37] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#9a332e] focus:outline-none focus:ring-2 focus:ring-[#C9F23B] cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Memproses..." : "Konfirmasi Pembatalan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
