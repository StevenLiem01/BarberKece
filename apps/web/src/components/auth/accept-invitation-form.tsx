"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AcceptInvitationFormProps {
  token: string;
  displayName: string;
  email: string;
  role: "BARBER" | "ADMIN";
}

export function AcceptInvitationForm({
  token,
  displayName,
  email,
  role,
}: AcceptInvitationFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const router = useRouter();

  const roleLabel = role === "BARBER" ? "Barber" : "Admin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationError(null);

    if (password.length < 8) {
      setValidationError("Kata sandi harus minimal 8 karakter");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Konfirmasi kata sandi tidak cocok");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/v1/auth/invitations/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ password }),
        },
      );

      const result = await response.json();

      if (response.ok) {
        router.push("/sign-in?invited=true");
      } else {
        if (response.status === 410) {
          setError(
            "Tautan undangan telah kedaluwarsa. Silakan hubungi Admin untuk undangan baru.",
          );
        } else if (
          response.status === 400 &&
          result.error?.code === "INVITATION_ALREADY_USED"
        ) {
          setError(
            "Undangan ini sudah pernah digunakan. Silakan masuk dengan akun Anda.",
          );
        } else if (response.status === 409) {
          setError("Akun dengan email ini sudah terdaftar. Silakan masuk.");
        } else if (response.status === 403) {
          setError("Pemeriksaan keamanan gagal. Silakan muat ulang halaman.");
        } else {
          setError(
            result.error?.message ||
              "Terjadi kesalahan saat memproses pendaftaran akun.",
          );
        }
        setIsLoading(false);
      }
    } catch {
      setError("Terjadi kesalahan jaringan. Silakan coba beberapa saat lagi.");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 w-full max-w-sm">
      {error && (
        <div
          className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Read-only profile details fixed by Admin */}
      <div className="bg-neutral-50 p-3.5 rounded-lg border border-neutral-200 space-y-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Nama Lengkap Staf
          </span>
          <p className="text-sm font-medium text-neutral-900">{displayName}</p>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-neutral-200">
          <div>
            <span className="text-xs text-neutral-500">Email</span>
            <p className="text-xs font-mono text-neutral-700">{email}</p>
          </div>
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-neutral-900 text-lime-400">
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-neutral-800"
        >
          Kata Sandi Baru
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          required
          minLength={8}
          placeholder="Minimal 8 karakter"
          className="w-full p-2.5 border rounded-md border-neutral-300 focus:ring-2 focus:ring-lime-400 focus:border-transparent outline-none transition-colors"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-neutral-800"
        >
          Konfirmasi Kata Sandi
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          required
          minLength={8}
          placeholder="Ulangi kata sandi"
          className="w-full p-2.5 border rounded-md border-neutral-300 focus:ring-2 focus:ring-lime-400 focus:border-transparent outline-none transition-colors"
        />
        {validationError && (
          <p className="text-red-500 text-xs mt-1">{validationError}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2.5 bg-neutral-900 text-white rounded-md font-semibold hover:bg-neutral-800 focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-50 transition-colors cursor-pointer"
      >
        {isLoading ? "Memproses..." : "Aktifkan Akun & Selesai"}
      </button>
    </form>
  );
}
