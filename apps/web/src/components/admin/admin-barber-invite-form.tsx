"use client";

import React, { useState } from "react";
import { UserPlus, CheckCircle, AlertTriangle, Send, RefreshCw } from "lucide-react";

export interface InviteBarberValidationResult {
  isValid: boolean;
  errors: {
    displayName?: string;
    email?: string;
  };
  cleanData: {
    displayName: string;
    email: string;
  };
}

export function validateBarberInviteInput(
  displayName: string,
  email: string,
): InviteBarberValidationResult {
  const errors: { displayName?: string; email?: string } = {};

  const cleanName = typeof displayName === "string" ? displayName.trim() : "";
  if (!cleanName) {
    errors.displayName = "Nama lengkap barber wajib diisi.";
  } else if (cleanName.length > 100) {
    errors.displayName = "Nama lengkap barber tidak boleh melebihi 100 karakter.";
  }

  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail) {
    errors.email = "Email barber wajib diisi.";
  } else if (!emailRegex.test(cleanEmail)) {
    errors.email = "Format email tidak valid.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanData: {
      displayName: cleanName,
      email: cleanEmail,
    },
  };
}

export interface AdminBarberInviteFormProps {
  onSuccess?: (invitation: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    expiresAt: string;
  }) => void;
}

export function AdminBarberInviteForm({ onSuccess }: AdminBarberInviteFormProps) {
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<{
    displayName?: string;
    email?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    displayName: string;
    email: string;
    expiresAt?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);

    const validation = validateBarberInviteInput(displayName, email);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }
    setValidationErrors({});

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          displayName: validation.cleanData.displayName,
          email: validation.cleanData.email,
          role: "BARBER",
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 409) {
          setSubmitError(
            "Pengguna dengan email ini sudah terdaftar di sistem.",
          );
        } else if (response.status === 400) {
          setSubmitError(
            result?.error?.message ||
              "Data undangan staf tidak valid. Periksa kembali nama dan email.",
          );
        } else if (response.status === 401 || response.status === 403) {
          setSubmitError(
            "Sesi admin tidak sah atau pemeriksaan keamanan gagal. Silakan masuk kembali.",
          );
        } else {
          // If server error or email dispatch failure occurs, explain accurately
          setSubmitError(
            "Gagal mengirim undangan email. Undangan mungkin belum terkirim ke inbox barber. Silakan coba lagi.",
          );
        }
        setIsSubmitting(false);
        return;
      }

      setSuccessData({
        displayName: validation.cleanData.displayName,
        email: validation.cleanData.email,
        expiresAt: result?.data?.expiresAt,
      });
      setDisplayName("");
      setEmail("");
      onSuccess?.(result?.data);
    } catch {
      setSubmitError(
        "Terjadi kesalahan jaringan saat mengirim undangan. Undangan mungkin belum terkirim ke inbox barber. Silakan coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSuccess = () => {
    setSuccessData(null);
    setSubmitError(null);
    setValidationErrors({});
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
        <div className="p-2 bg-neutral-900 text-lime-400 rounded-lg">
          <UserPlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
            Undang Barber Baru
          </h2>
          <p className="text-xs text-neutral-600 mt-0.5">
            Kirim undangan resmi ke staf barber melalui email untuk bergabung dengan BarberKece.
          </p>
        </div>
      </div>

      {successData ? (
        <div
          data-testid="invite-success-card"
          className="mt-5 p-4 sm:p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3"
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-emerald-950">
                Undangan Barber Berhasil Dibuat &amp; Dikirim!
              </h3>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Tautan undangan telah dikirimkan ke email{" "}
                <span className="font-semibold text-emerald-950">
                  {successData.email}
                </span>{" "}
                untuk barber{" "}
                <span className="font-semibold text-emerald-950">
                  {successData.displayName}
                </span>
                .
              </p>
              <div className="mt-2 p-2.5 bg-white/80 rounded-lg border border-emerald-200/80 text-xs text-emerald-900 space-y-1">
                <p className="font-semibold">Perhatian Penting:</p>
                <p>
                  Akun barber belum aktif dan belum muncul di daftar barber aktif.
                  Staf barber wajib membuka email tersebut dan menyetujui undangan untuk
                  membuat kata sandi sebelum akun resmi dibuat di sistem.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleResetSuccess}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Undang Barber Lain</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          {submitError && (
            <div
              data-testid="invite-error-alert"
              role="alert"
              className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Display Name Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="invite-displayName"
                  className="text-xs font-bold text-neutral-800 uppercase tracking-wider"
                >
                  Nama Lengkap Barber <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-neutral-400 font-mono">
                  {displayName.length}/100
                </span>
              </div>
              <input
                id="invite-displayName"
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (validationErrors.displayName) {
                    setValidationErrors((prev) => ({ ...prev, displayName: undefined }));
                  }
                }}
                disabled={isSubmitting}
                maxLength={100}
                placeholder="Contoh: Budi Santoso"
                aria-invalid={!!validationErrors.displayName}
                aria-describedby={
                  validationErrors.displayName ? "displayName-error" : undefined
                }
                className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg outline-none transition-colors disabled:bg-neutral-100 ${
                  validationErrors.displayName
                    ? "border-red-400 focus:ring-2 focus:ring-red-300"
                    : "border-neutral-300 focus:ring-2 focus:ring-lime-400 focus:border-transparent"
                }`}
              />
              {validationErrors.displayName && (
                <p
                  id="displayName-error"
                  role="alert"
                  className="text-xs font-medium text-red-600 flex items-center gap-1 mt-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{validationErrors.displayName}</span>
                </p>
              )}
            </div>

            {/* Email Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="invite-email"
                className="text-xs font-bold text-neutral-800 uppercase tracking-wider"
              >
                Email Barber <span className="text-red-500">*</span>
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (validationErrors.email) {
                    setValidationErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                disabled={isSubmitting}
                placeholder="budi@contoh.com"
                aria-invalid={!!validationErrors.email}
                aria-describedby={
                  validationErrors.email ? "email-error" : undefined
                }
                className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg outline-none transition-colors disabled:bg-neutral-100 ${
                  validationErrors.email
                    ? "border-red-400 focus:ring-2 focus:ring-red-300"
                    : "border-neutral-300 focus:ring-2 focus:ring-lime-400 focus:border-transparent"
                }`}
              />
              {validationErrors.email && (
                <p
                  id="email-error"
                  role="alert"
                  className="text-xs font-medium text-red-600 flex items-center gap-1 mt-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{validationErrors.email}</span>
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-100">
            <p className="text-xs text-neutral-500">
              Undangan berlaku selama 48 jam. Barber baru akan dibuat setelah staf menyetujui email.
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-900 text-lime-400 hover:bg-neutral-800 disabled:opacity-50 text-sm font-semibold rounded-lg transition-colors cursor-pointer shadow-sm focus:ring-2 focus:ring-lime-400"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mengirim Undangan...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Kirim Undangan Barber</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
