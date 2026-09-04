import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Reset password
          </h1>
          <p className="text-neutral-500 text-sm">
            We&apos;ll send you a link to reset your password
          </p>
        </div>

        <ForgotPasswordForm />

        <div className="text-center text-sm text-neutral-600">
          <Link
            href="/sign-in"
            className="font-medium text-neutral-900 hover:underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
