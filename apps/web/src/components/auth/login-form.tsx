"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginSchema } from "@barberkece/contracts";
import { resolveAuthRedirect } from "@/lib/auth-redirect";

interface LoginFormProps {
  nextUrl?: string;
}

export function LoginForm({ nextUrl }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(
        parsed.error.flatten().fieldErrors as Record<string, string[]>,
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(parsed.data),
      });

      const result = await response.json();

      if (response.ok) {
        const role = result.data?.role;
        const target = resolveAuthRedirect(role, nextUrl);

        router.push(target);
        router.refresh();
      } else {
        if (response.status === 401) {
          setError("Invalid email or password");
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
          htmlFor="email"
          className="block text-sm font-medium text-neutral-700"
        >
          Email
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

      <div className="space-y-1">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-neutral-700"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          className={`w-full p-2 border rounded focus:ring-2 focus:ring-lime-400 focus:border-transparent outline-none ${
            fieldErrors.password ? "border-red-500" : "border-neutral-300"
          }`}
          aria-invalid={!!fieldErrors.password}
        />
        {fieldErrors.password && (
          <p className="text-red-500 text-sm">{fieldErrors.password[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-2 bg-neutral-900 text-white rounded font-medium hover:bg-neutral-800 focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-50 transition-colors"
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
