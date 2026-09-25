import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Scissors } from "lucide-react";
import { AdminBarbersRecovery } from "@/components/admin/admin-barbers-recovery";
import { AdminBarberInviteForm } from "@/components/admin/admin-barber-invite-form";

export const metadata: Metadata = {
  title: "Kelola & Pemulihan Barber | Admin BarberKece",
  description:
    "Kelola daftar staf barber, periksa kelengkapan nama, pulihkan akun barber, dan undang staf barber baru.",
};

export const runtime = "nodejs";

export default function AdminBarbersPage() {
  return (
    <main className="min-h-screen bg-neutral-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard Admin</span>
          </Link>
        </div>

        {/* Header Title */}
        <div className="border-b border-neutral-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-neutral-900 text-lime-400 rounded-xl">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-neutral-950 tracking-tight">
                Kelola &amp; Pemulihan Barber
              </h1>
              <p className="text-sm text-neutral-600 mt-1">
                Pantau staf barber aktif, lengkapi nama akun barber, atau undang
                staf barber baru untuk bergabung.
              </p>
            </div>
          </div>
        </div>

        {/* Minimal Admin Barber Invitation Form */}
        <AdminBarberInviteForm />

        {/* Barber Recovery Component */}
        <AdminBarbersRecovery />
      </div>
    </main>
  );
}
