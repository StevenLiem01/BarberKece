"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmPasswordResetSchema } from "@barberkece/contracts";

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = ConfirmPasswordResetSchema.safeParse({ token, newPassword });
    if (!parsed.success) {
      setFieldErrors(
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(parsed.data),
      });

      const result = await response.json();

      if (response.ok) {
        router.push("/sign-in?reset=true");
      } else {
        if (
          response.status === 400 &&
          result.error?.code === "INVALID_RESET_TOKEN"
        ) {
          setError("Invalid or expired password reset token");
        } else if (response.status === 403) {
          setError("Security check failed. Please refresh and try again.");
        } else {
          setError(result.error?.message || "An unexpected error occurred");
        }
        setIsLoading(false);
      }
    } catch {
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      {error && (
        <div
          className="p-3 bg-red-100 text-red-700 rounded text-sm"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-neutral-700"
        >
          New Password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={isLoading}
          className={`w-full p-2 border rounded focus:ring-2 focus:ring-lime-400 focus:border-transparent outline-none ${
            fieldErrors.newPassword ? "border-red-500" : "border-neutral-300"
          }`}
          aria-invalid={!!fieldErrors.newPassword}
        />
        {fieldErrors.newPassword && (
          <p className="text-red-500 text-sm">{fieldErrors.newPassword[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 bg-neutral-900 text-white rounded font-medium hover:bg-neutral-800 focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-50 transition-colors"
      >
        {isLoading ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}
