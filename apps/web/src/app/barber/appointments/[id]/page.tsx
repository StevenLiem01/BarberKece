import { Metadata } from "next";
import { BarberAppointmentDetail } from "@/components/barber/barber-appointment-detail";

export const metadata: Metadata = {
  title: "Detail Janji Temu Barber | BarberKece",
  description:
    "Rincian lengkap dan tindakan operasional janji temu barber di BarberKece.",
};

interface BarberAppointmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BarberAppointmentDetailPage({
  params,
}: BarberAppointmentDetailPageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#F3F0E8] py-6 sm:py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <BarberAppointmentDetail appointmentId={id} />
      </div>
    </main>
  );
}
