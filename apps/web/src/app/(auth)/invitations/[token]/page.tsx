import Link from "next/link";
import { ValidateStaffInvitationUseCase } from "@barberkece/core/identity";
import {
  PostgresStaffInvitationRepository,
  PostgresUserRepository,
} from "@barberkece/database/repositories";
import { NodeCryptoTokenAdapter } from "@barberkece/infrastructure/identity";
import { getDatabaseClient } from "@/lib/db";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";

export const runtime = "nodejs";

interface InvitationPageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;

  if (!token || token.trim() === "") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
        <div className="w-full max-w-sm space-y-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Tautan Tidak Valid
          </h1>
          <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
            Tautan undangan tidak lengkap atau tidak valid.
          </div>
          <Link
            href="/sign-in"
            className="inline-block text-sm font-medium text-neutral-900 hover:underline"
          >
            Kembali ke Halaman Masuk
          </Link>
        </div>
      </main>
    );
  }

  const dbClient = getDatabaseClient();
  const staffInvitationRepository = new PostgresStaffInvitationRepository(
    dbClient.db,
  );
  const userRepository = new PostgresUserRepository(dbClient.db);
  const tokenPort = new NodeCryptoTokenAdapter();

  const validateUseCase = new ValidateStaffInvitationUseCase(
    staffInvitationRepository,
    tokenPort,
    userRepository,
  );

  const validation = await validateUseCase.execute({ token });

  if (!validation.isValid) {
    let errorTitle = "Undangan Tidak Ditemukan";
    let errorMessage =
      "Tautan undangan tidak valid atau tidak ditemukan dalam sistem.";

    if (validation.reason === "EXPIRED") {
      errorTitle = "Undangan Kedaluwarsa";
      errorMessage =
        "Masa berlaku undangan ini telah habis (lebih dari 48 jam). Silakan hubungi Admin untuk mengirimkan tautan undangan baru.";
    } else if (validation.reason === "USED") {
      errorTitle = "Undangan Sudah Digunakan";
      errorMessage =
        "Tautan undangan ini telah selesai digunakan untuk membuat akun. Silakan langsung masuk ke sistem.";
    } else if (validation.reason === "USER_ALREADY_EXISTS") {
      errorTitle = "Akun Sudah Terdaftar";
      errorMessage =
        "Akun untuk alamat email ini sudah terdaftar dan aktif. Silakan masuk dengan kata sandi Anda.";
    }

    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              {errorTitle}
            </h1>
            <p className="text-neutral-600 text-sm">{errorMessage}</p>
          </div>

          <div className="pt-2">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors"
            >
              Menuju Halaman Masuk
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const roleLabel = validation.role === "BARBER" ? "Barber" : "Admin";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-block text-xs uppercase tracking-widest font-semibold text-neutral-500">
            Undangan Bergabung
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
            Aktivasi Akun Staf
          </h1>
          <p className="text-neutral-600 text-sm">
            Selamat datang di BarberKece! Silakan lengkapi kata sandi untuk
            mengaktifkan akun {roleLabel} Anda.
          </p>
        </div>

        <AcceptInvitationForm
          token={token}
          displayName={validation.displayName ?? "Staf BarberKece"}
          email={validation.email ?? ""}
          role={validation.role ?? "BARBER"}
        />

        <div className="text-center text-sm text-neutral-600">
          <Link
            href="/sign-in"
            className="font-medium text-neutral-900 hover:underline underline-offset-4"
          >
            Sudah punya akun? Masuk di sini
          </Link>
        </div>
      </div>
    </main>
  );
}
