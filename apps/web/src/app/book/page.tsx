import { Metadata } from "next";
import { getAuthenticatedUser } from "@/lib/auth";
import { BookingWizard } from "@/components/reservation/booking-wizard";

export const metadata: Metadata = {
  title: "Reservasi Layanan | BarberKece",
  description:
    "Pilih layanan potong rambut, barber favorit, dan jadwal kedatangan Anda di BarberKece.",
};

export default async function BookPage() {
  const user = await getAuthenticatedUser();
  const isAuthenticated = !!user && user.role === "CUSTOMER";

  return (
    <main className="min-h-screen bg-[#F3F0E8] py-6 sm:py-10">
      <BookingWizard isAuthenticated={isAuthenticated} />
    </main>
  );
}
