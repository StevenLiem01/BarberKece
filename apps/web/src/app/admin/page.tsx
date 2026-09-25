import Link from "next/link";
import { Scissors, ChevronRight } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

export default function AdminPage() {
  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-950">
            Dashboard Admin
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Pusat kendali dan administrasi operasional BarberKece.
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/barbers"
          className="group p-5 bg-white rounded-xl border border-neutral-200 shadow-sm hover:border-neutral-900 hover:shadow-md transition-all flex items-start gap-4"
        >
          <div className="p-3 bg-neutral-900 text-lime-400 rounded-lg group-hover:scale-105 transition-transform">
            <Scissors className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900 group-hover:text-neutral-950 font-sans">
                Kelola &amp; Pemulihan Barber
              </h2>
              <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
            </div>
            <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">
              Periksa daftar staf barber, identifikasi barber yang belum
              memiliki nama, dan pulihkan akun agar dapat dipilih pada layanan
              booking publik.
            </p>
          </div>
        </Link>
      </div>
    </main>
  );
}
