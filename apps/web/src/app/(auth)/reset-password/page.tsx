import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import Link from "next/link";

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;
  const token = params.token;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Choose new password
          </h1>
          <p className="text-neutral-500 text-sm">
            Enter your new password below
          </p>
        </div>

        {!token ? (
          <div className="p-3 bg-red-100 text-red-700 rounded text-sm text-center">
            Missing reset token. Please use the link from your email.
          </div>
        ) : (
          <ResetPasswordForm token={token} />
        )}

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
