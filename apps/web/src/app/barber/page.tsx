import { Metadata } from "next";
import { BarberTodayWorkspace } from "@/components/barber/barber-today-workspace";

export const metadata: Metadata = {
  title: "Workspace Barber — Hari Ini | BarberKece",
  description:
    "Workspace operasional barber hari ini untuk memantau jadwal, janji temu aktif, dan pembaruan status layanan.",
};

export default function BarberPage() {
  return (
    <main className="min-h-screen bg-[#F3F0E8] py-6 sm:py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <BarberTodayWorkspace />
      </div>
    </main>
  );
}
