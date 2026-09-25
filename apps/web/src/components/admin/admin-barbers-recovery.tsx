"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AdminBarberDto } from "@barberkece/contracts";
import {
  AlertTriangle,
  CheckCircle,
  Edit2,
  RefreshCw,
  User,
  Scissors,
  Check,
  X,
} from "lucide-react";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  cleanName: string;
}

export function validateBarberDisplayName(name: string): ValidationResult {
  if (!name || typeof name !== "string") {
    return {
      isValid: false,
      error: "Nama barber wajib diisi dan tidak boleh kosong.",
      cleanName: "",
    };
  }
  const cleanName = name.trim();
  if (cleanName.length === 0) {
    return {
      isValid: false,
      error: "Nama barber wajib diisi dan tidak boleh hanya berisi spasi.",
      cleanName: "",
    };
  }
  if (cleanName.length > 100) {
    return {
      isValid: false,
      error: "Nama barber tidak boleh melebihi 100 karakter.",
      cleanName,
    };
  }
  return {
    isValid: true,
    cleanName,
  };
}

export interface AdminBarbersRecoveryProps {
  initialBarbers?: AdminBarberDto[];
}

export function AdminBarbersRecovery({
  initialBarbers,
}: AdminBarbersRecoveryProps) {
  const [barbers, setBarbers] = useState<AdminBarberDto[]>(
    initialBarbers ?? [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(!initialBarbers);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Editing state
  const [editingBarberId, setEditingBarberId] = useState<string | null>(null);
  const [inputName, setInputName] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(
    null,
  );

  const fetchBarbers = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch("/api/v1/admin/barbers", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setFetchError("Sesi admin tidak sah. Silakan masuk kembali.");
        } else {
          setFetchError("Gagal memuat daftar barber. Silakan coba lagi.");
        }
        setIsLoading(false);
        return;
      }

      const result = await response.json();
      setBarbers(result.data ?? []);
    } catch {
      setFetchError("Terjadi kesalahan jaringan saat memuat daftar barber.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialBarbers) return;

    let ignore = false;
    async function load() {
      try {
        const response = await fetch("/api/v1/admin/barbers", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
        });

        if (ignore) return;

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setFetchError("Sesi admin tidak sah. Silakan masuk kembali.");
          } else {
            setFetchError("Gagal memuat daftar barber. Silakan coba lagi.");
          }
          setIsLoading(false);
          return;
        }

        const result = await response.json();
        if (ignore) return;
        setBarbers(result.data ?? []);
      } catch {
        if (!ignore) {
          setFetchError(
            "Terjadi kesalahan jaringan saat memuat daftar barber.",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [initialBarbers]);

  const handleStartEdit = (barber: AdminBarberDto) => {
    setEditingBarberId(barber.id);
    setInputName(barber.displayName ?? "");
    setValidationError(null);
    setSaveError(null);
    setSaveSuccessMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingBarberId(null);
    setInputName("");
    setValidationError(null);
    setSaveError(null);
  };

  const handleSaveDisplayName = async (barberId: string) => {
    setSaveError(null);
    setValidationError(null);
    setSaveSuccessMessage(null);

    const validation = validateBarberDisplayName(inputName);
    if (!validation.isValid) {
      setValidationError(validation.error!);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/v1/admin/barbers/${encodeURIComponent(barberId)}/display-name`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ displayName: validation.cleanName }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 400) {
          setSaveError(
            result.error?.message ||
              "Nama barber tidak valid. Pastikan 1–100 karakter.",
          );
        } else if (response.status === 403) {
          setSaveError("Akses ditolak atau pemeriksaan keamanan gagal.");
        } else if (response.status === 404) {
          setSaveError("Profil barber tidak ditemukan.");
        } else {
          setSaveError(
            result.error?.message ||
              "Gagal menyimpan nama barber. Silakan coba lagi.",
          );
        }
        setIsSaving(false);
        return;
      }

      const updatedBarber: AdminBarberDto = result.data;

      // Update state locally and clear editing mode
      setBarbers((prev) =>
        prev.map((b) => (b.id === updatedBarber.id ? updatedBarber : b)),
      );
      setEditingBarberId(null);
      setInputName("");
      setSaveSuccessMessage(
        `Nama untuk barber ${updatedBarber.displayName} berhasil diperbarui!`,
      );
    } catch {
      setSaveError(
        "Terjadi kesalahan jaringan saat memperbarui nama barber. Silakan coba lagi.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const unnamedCount = barbers.filter(
    (b) => b.missingDisplayName || !b.displayName,
  ).length;

  return (
    <div className="space-y-6">
      {/* Overview Statistics Banner */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 tracking-wide">
              Ringkasan Staf Barber
            </h2>
            <p className="text-sm text-neutral-600 mt-0.5">
              Kelola nama lengkap staf barber untuk menjamin ketersediaan pada
              layanan reservasi publik.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchBarbers}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-neutral-300 text-neutral-700 bg-neutral-50 hover:bg-neutral-100 disabled:opacity-50 cursor-pointer transition-colors"
              aria-label="Segarkan daftar barber"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-4 border-t border-neutral-100">
          <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
            <div className="w-10 h-10 rounded-full bg-neutral-900 text-lime-400 flex items-center justify-center font-bold">
              {barbers.length}
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Total Barber Terdaftar
              </p>
              <p className="text-sm font-medium text-neutral-900">
                {barbers.length} staf di sistem
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              unnamedCount > 0
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-emerald-50 border-emerald-200 text-emerald-900"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                unnamedCount > 0
                  ? "bg-amber-500 text-white"
                  : "bg-emerald-600 text-white"
              }`}
            >
              {unnamedCount}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider">
                Status Kelengkapan Nama
              </p>
              <p className="text-sm font-medium">
                {unnamedCount > 0
                  ? `${unnamedCount} barber belum memiliki nama (tersembunyi)`
                  : "Semua barber memiliki nama lengkap"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Success Notification */}
      {saveSuccessMessage && (
        <div
          role="status"
          className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm shadow-sm"
        >
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{saveSuccessMessage}</p>
          </div>
          <button
            onClick={() => setSaveSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-medium cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {fetchError && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm shadow-sm"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Gagal Mengambil Data</p>
            <p className="text-xs mt-0.5">{fetchError}</p>
          </div>
          <button
            onClick={fetchBarbers}
            className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 cursor-pointer transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div
          data-testid="loading-state"
          className="bg-white rounded-xl border border-neutral-200 p-8 text-center space-y-3"
        >
          <div className="w-8 h-8 border-3 border-neutral-300 border-t-neutral-900 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-neutral-600">
            Memuat daftar staf barber...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !fetchError && barbers.length === 0 && (
        <div
          data-testid="empty-state"
          className="bg-white rounded-xl border border-neutral-200 p-10 text-center space-y-3 shadow-sm"
        >
          <User className="w-12 h-12 text-neutral-400 mx-auto" />
          <h3 className="text-base font-bold text-neutral-800">
            Belum Ada Data Staf Barber
          </h3>
          <p className="text-sm text-neutral-500 max-w-sm mx-auto">
            Tidak ditemukan profil barber di dalam sistem saat ini. Undangan
            staf baru dapat dikirimkan melalui menu undangan staf.
          </p>
        </div>
      )}

      {/* Barbers List */}
      {!isLoading && barbers.length > 0 && (
        <div className="space-y-4">
          {barbers.map((barber) => {
            const isUnnamed = barber.missingDisplayName || !barber.displayName;
            const isEditing = editingBarberId === barber.id;

            return (
              <div
                key={barber.id}
                data-testid={`barber-card-${barber.id}`}
                className={`bg-white rounded-xl border transition-shadow shadow-sm overflow-hidden ${
                  isUnnamed
                    ? "border-amber-300 ring-1 ring-amber-200"
                    : "border-neutral-200"
                }`}
              >
                {/* Prominent Warning Header for Unnamed Barbers */}
                {isUnnamed && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="bg-amber-500 text-neutral-950 px-4 py-2.5 flex items-center gap-2.5 text-xs font-semibold tracking-wide"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 text-neutral-950" />
                    <span>
                      PERINGATAN: Barber ini belum memiliki nama lengkap dan{" "}
                      <strong>disembunyikan</strong> dari pencarian publik serta
                      sistem booking.
                    </span>
                  </div>
                )}

                <div className="p-5 sm:p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold text-neutral-900 tracking-wide font-sans">
                          {barber.displayName ? (
                            barber.displayName
                          ) : (
                            <span className="text-amber-800 italic font-medium">
                              (Nama Belum Diatur)
                            </span>
                          )}
                        </span>

                        {isUnnamed ? (
                          <span
                            data-testid={`badge-unnamed-${barber.id}`}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"
                          >
                            Perlu Pemulihan Nama
                          </span>
                        ) : (
                          <span
                            data-testid={`badge-active-${barber.id}`}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"
                          >
                            Nama Lengkap
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          <Scissors className="w-3.5 h-3.5 text-neutral-400" />
                          <span>
                            Spesialisasi:{" "}
                            <strong className="text-neutral-700">
                              {barber.specialization || "Umum / Semua Gaya"}
                            </strong>
                          </span>
                        </span>
                        <span className="text-neutral-300">|</span>
                        <span>
                          ID Profil:{" "}
                          <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-600 font-mono text-[11px]">
                            {barber.id.substring(0, 8)}...
                          </code>
                        </span>
                      </div>
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-2 pt-2 md:pt-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(barber)}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                            isUnnamed
                              ? "bg-neutral-900 text-lime-400 hover:bg-neutral-800 focus:ring-2 focus:ring-lime-400 shadow-sm"
                              : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 focus:ring-2 focus:ring-neutral-400"
                          }`}
                        >
                          <Edit2 className="w-4 h-4" />
                          <span>
                            {isUnnamed ? "Lengkapi Nama" : "Ubah Nama"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline Recovery / Edit Form */}
                  {isEditing && (
                    <div
                      data-testid={`edit-form-${barber.id}`}
                      className="mt-4 pt-4 border-t border-neutral-200 bg-neutral-50 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-5 sm:p-6 space-y-4 rounded-b-xl"
                    >
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`displayName-${barber.id}`}
                          className="block text-sm font-bold text-neutral-900"
                        >
                          {isUnnamed
                            ? "Masukkan Nama Lengkap Barber"
                            : "Perbarui Nama Lengkap Barber"}
                        </label>
                        <p className="text-xs text-neutral-500">
                          Nama ini akan ditampilkan pada sistem pemesanan dan
                          dapat dilihat oleh pelanggan. Maksimal 100 karakter.
                        </p>
                        <div className="relative mt-1">
                          <input
                            id={`displayName-${barber.id}`}
                            type="text"
                            value={inputName}
                            onChange={(e) => {
                              setInputName(e.target.value);
                              if (validationError) setValidationError(null);
                            }}
                            disabled={isSaving}
                            maxLength={100}
                            placeholder="Contoh: Budi Santoso"
                            className="w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg border-neutral-300 focus:ring-2 focus:ring-lime-400 focus:border-transparent outline-none transition-colors disabled:bg-neutral-100"
                            autoFocus
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-neutral-400 font-mono">
                            {inputName.length}/100
                          </span>
                        </div>

                        {validationError && (
                          <p
                            role="alert"
                            className="text-xs font-semibold text-red-600 mt-1 flex items-center gap-1"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{validationError}</span>
                          </p>
                        )}
                      </div>

                      {saveError && (
                        <div
                          data-testid="save-error-alert"
                          role="alert"
                          className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium flex items-center gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                          <span>{saveError}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveDisplayName(barber.id)}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-lime-400 hover:bg-neutral-800 disabled:opacity-50 text-sm font-semibold rounded-lg transition-colors cursor-pointer shadow-sm focus:ring-2 focus:ring-lime-400"
                        >
                          <Check className="w-4 h-4" />
                          <span>
                            {isSaving ? "Menyimpan..." : "Simpan Nama"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>Batal</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
