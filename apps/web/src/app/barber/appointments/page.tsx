import { Metadata } from "next";
import { BarberAppointmentsHub } from "@/components/barber/barber-appointments-hub";

export const metadata: Metadata = {
  title: "Daftar Janji Temu Barber | BarberKece",
  description:
    "Daftar riwayat dan jadwal lengkap janji temu operasional barber di BarberKece.",
};

export default function BarberAppointmentsPage() {
  return (
    <main className="min-h-screen bg-[#F3F0E8] py-6 sm:py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <BarberAppointmentsHub />
      </div>
    </main>
  );
}
