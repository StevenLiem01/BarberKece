import { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getDatabaseClient } from "@/lib/db";
import {
  GetCustomerAppointmentsUseCase,
  ListServicesUseCase,
} from "@barberkece/core/reservation";
import { ListBarbersUseCase } from "@barberkece/core/barber";
import {
  PostgresAppointmentRepository,
  PostgresServiceRepository,
  PostgresBarberProfileRepository,
} from "@barberkece/database/repositories";
import { AppointmentsListView } from "@/components/reservation/appointments-list-view";
import { AppointmentCardData } from "@/components/reservation/appointment-card";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Janji Temu Saya | BarberKece",
  description:
    "Daftar jadwal dan riwayat janji temu potong rambut Anda di BarberKece.",
};

export default async function CustomerAppointmentsPage() {
  const user = await requireRole("CUSTOMER");

  const dbClient = getDatabaseClient();
  const appointmentRepo = new PostgresAppointmentRepository(dbClient.db);
  const serviceRepo = new PostgresServiceRepository(dbClient.db);
  const barberRepo = new PostgresBarberProfileRepository(dbClient.db);

  const getCustomerAppointmentsUseCase = new GetCustomerAppointmentsUseCase(
    appointmentRepo,
  );
  const listServicesUseCase = new ListServicesUseCase(serviceRepo);
  const listBarbersUseCase = new ListBarbersUseCase(barberRepo);

  const [appointments, services, barbers] = await Promise.all([
    getCustomerAppointmentsUseCase.execute(user.id),
    listServicesUseCase.execute("all").catch(() => []),
    listBarbersUseCase.execute().catch(() => []),
  ]);

  const serviceMap = new Map(services.map((s) => [s.id, s.name]));
  const barberMap = new Map(barbers.map((b) => [b.id, b.specialization]));

  const appointmentItems: AppointmentCardData[] = appointments.map((a) => ({
    id: a.id,
    bookingReference: a.bookingReference,
    status: a.status,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    priceRupiah: a.priceRupiah,
    serviceDurationMinutes: a.serviceDurationMinutes,
    serviceName: serviceMap.get(a.serviceId) ?? null,
    barberSpecialization: a.barberProfileId
      ? (barberMap.get(a.barberProfileId) ?? null)
      : null,
    isAutoAssigned: a.isAutoAssigned,
  }));

  return (
    <main className="min-h-screen bg-[#F3F0E8] py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#11110F]">
              Janji Temu Saya
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6E6C65]">
              Kelola jadwal potong rambut mendatang dan lihat riwayat kunjungan
              Anda.
            </p>
          </div>

          <Link
            href="/book"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#C9F23B] text-[#11110F] text-xs font-extrabold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#b4db29] focus:outline-none focus:ring-2 focus:ring-[#11110F] shadow-xs shrink-0 cursor-pointer"
          >
            <span>Buat Janji Temu</span>
          </Link>
        </div>

        {/* Appointments List / Tabs */}
        <AppointmentsListView appointments={appointmentItems} />
      </div>
    </main>
  );
}
