"use client";

import { useState } from "react";
import { RequestPasswordResetSchema } from "@barberkece/contracts";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = RequestPasswordResetSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors(
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(parsed.data),
      });

      const result = await response.json();

      if (response.ok) {
        setIsSuccess(true);
      } else {
        if (response.status === 403) {
          setError("Security check failed. Please refresh and try again.");
        } else {
          setError(result.error?.message || "An unexpected error occurred");
        }
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-sm p-6 bg-lime-50 text-neutral-900 rounded-lg border border-lime-200">
        <h2 className="text-lg font-bold mb-2">Check your email</h2>
        <p className="text-sm">
          If an account exists for that email, we have sent instructions to
          reset your password.
        </p>
      </div>
    );
  }

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
          htmlFor="email"
          className="block text-sm font-medium text-neutral-700"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className={`w-full p-2 border rounded focus:ring-2 focus:ring-lime-400 focus:border-transparent outline-none ${
            fieldErrors.email ? "border-red-500" : "border-neutral-300"
          }`}
          aria-invalid={!!fieldErrors.email}
        />
        {fieldErrors.email && (
          <p className="text-red-500 text-sm">{fieldErrors.email[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 bg-neutral-900 text-white rounded font-medium hover:bg-neutral-800 focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-50 transition-colors"
      >
        {isLoading ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
