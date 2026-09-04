import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

interface SignInPageProps {
  searchParams: Promise<{ next?: string; registered?: string; reset?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextUrl = params.next;
  const registered = params.registered;
  const reset = params.reset;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Sign in
          </h1>
          <p className="text-neutral-500 text-sm">Welcome back to BarberKece</p>
        </div>

        {registered === "true" && (
          <div className="p-3 bg-lime-50 border border-lime-200 text-neutral-900 rounded text-sm text-center">
            Registration successful! Please sign in.
          </div>
        )}

        {reset === "true" && (
          <div className="p-3 bg-lime-50 border border-lime-200 text-neutral-900 rounded text-sm text-center">
            Password reset successful! Please sign in.
          </div>
        )}

        <LoginForm nextUrl={nextUrl} />

        <div className="text-center text-sm text-neutral-600 space-y-2">
          <div>
            <Link
              href="/forgot-password"
              className="hover:text-neutral-900 underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </div>
          <div>
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-medium text-neutral-900 hover:underline underline-offset-4"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
