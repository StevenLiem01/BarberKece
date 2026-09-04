import { RegisterForm } from "@/components/auth/register-form";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Create an account
          </h1>
          <p className="text-neutral-500 text-sm">Join BarberKece today</p>
        </div>

        <RegisterForm />

        <div className="text-center text-sm text-neutral-600">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-neutral-900 hover:underline underline-offset-4"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
