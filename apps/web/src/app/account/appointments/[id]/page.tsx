import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getDatabaseClient } from "@/lib/db";
import {
  GetAppointmentUseCase,
  GetServiceUseCase,
} from "@barberkece/core/reservation";
import { GetBarberProfileUseCase } from "@barberkece/core/barber";
import {
  PostgresAppointmentRepository,
  PostgresServiceRepository,
  PostgresBarberProfileRepository,
} from "@barberkece/database/repositories";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  ClockIcon,
  ScissorsIcon,
  UserIcon,
  ArrowLeftIcon,
} from "@/components/ui/icons";
import {
  formatRupiah,
  formatTimeWib,
  formatDateIndonesian,
} from "@/lib/format";
import { AppointmentDetailActions } from "@/components/reservation/cancel-appointment-dialog";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Detail Janji Temu | BarberKece",
  description: "Rincian informasi janji temu potong rambut Anda di BarberKece.",
};

interface AppointmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerAppointmentDetailPage({
  params,
}: AppointmentDetailPageProps) {
  const { id } = await params;
  const user = await requireRole("CUSTOMER");

  const dbClient = getDatabaseClient();
  const appointmentRepo = new PostgresAppointmentRepository(dbClient.db);
  const getAppointmentUseCase = new GetAppointmentUseCase(appointmentRepo);

  let appointment;
  try {
    // IDOR protection: GetAppointmentUseCase enforces ownership against user.id
    appointment = await getAppointmentUseCase.execute(id, user.id);
  } catch {
    notFound();
  }

  // Load catalog details
  const serviceRepo = new PostgresServiceRepository(dbClient.db);
  const getServiceUseCase = new GetServiceUseCase(serviceRepo);
  const barberRepo = new PostgresBarberProfileRepository(dbClient.db);
  const getBarberProfileUseCase = new GetBarberProfileUseCase(barberRepo);

  let serviceName = "Layanan Potong Rambut";
  try {
    const service = await getServiceUseCase.execute(appointment.serviceId);
    serviceName = service.name;
  } catch {
    // Keep fallback
  }

  let barberSpecialization: string | null = null;
  if (appointment.barberProfileId) {
    try {
      const barber = await getBarberProfileUseCase.execute(
        appointment.barberProfileId,
      );
      barberSpecialization = barber.specialization;
    } catch {
      // Keep null
    }
  }

  const dateStr = appointment.startsAt.toISOString().slice(0, 10);
  const barberLabel = barberSpecialization ?? "Barber Staff";

  return (
    <main className="min-h-screen bg-[#F3F0E8] py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation Back */}
        <div>
          <Link
            href="/account/appointments"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6E6C65] hover:text-[#11110F] transition-colors"
          >
            <ArrowLeftIcon size={16} aria-hidden="true" />
            <span>Kembali ke Janji Temu Saya</span>
          </Link>
        </div>

        {/* Header Receipt Card */}
        <div className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-6 sm:p-8 text-center shadow-xs space-y-4">
          <div className="flex justify-center">
            <Badge status={appointment.status} />
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#11110F]">
              Detail Janji Temu
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#6E6C65]">
              Informasi lengkap reservasi kunjungan Anda.
            </p>
          </div>

          {/* Booking Reference Box */}
          <div className="p-4 bg-[#F3F0E8] border border-[#D8D4CA] rounded-xl inline-block max-w-full">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E6C65]">
              Kode Reservasi
            </p>
            <p
              data-testid="booking-reference-display"
              className="text-xl sm:text-2xl font-black uppercase tracking-widest text-[#11110F] mt-0.5"
            >
              {appointment.bookingReference}
            </p>
          </div>
        </div>

        {/* Detailed Receipt Card */}
        <div className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-6 sm:p-8 shadow-xs">
          <h2 className="text-base font-bold uppercase tracking-wider text-[#11110F] pb-3 border-b border-[#D8D4CA]">
            Rincian Reservasi
          </h2>

          <dl className="mt-4 space-y-4 divide-y divide-[#D8D4CA]/60 text-sm">
            {/* Service */}
            <div className="pt-3 first:pt-0 flex justify-between items-start gap-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
                <ScissorsIcon size={16} className="text-[#11110F]" />
                Layanan
              </dt>
              <dd className="text-right">
                <p className="font-bold text-[#11110F]">{serviceName}</p>
                <p className="text-xs text-[#6E6C65]">
                  {appointment.serviceDurationMinutes} menit
                </p>
              </dd>
            </div>

            {/* Barber */}
            <div className="pt-3 flex justify-between items-start gap-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
                <UserIcon size={16} className="text-[#11110F]" />
                Barber
              </dt>
              <dd className="text-right">
                <p className="font-bold text-[#11110F]">{barberLabel}</p>
                {appointment.isAutoAssigned && (
                  <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#2F7D4A]/10 text-[#2F7D4A] rounded">
                    Ditugaskan Otomatis
                  </span>
                )}
              </dd>
            </div>

            {/* Date */}
            <div className="pt-3 flex justify-between items-start gap-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
                <CalendarIcon size={16} className="text-[#11110F]" />
                Tanggal
              </dt>
              <dd className="font-bold text-[#11110F] text-right">
                {formatDateIndonesian(dateStr)}
              </dd>
            </div>

            {/* Time */}
            <div className="pt-3 flex justify-between items-start gap-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
                <ClockIcon size={16} className="text-[#11110F]" />
                Waktu
              </dt>
              <dd className="font-bold text-[#11110F] text-right">
                {formatTimeWib(appointment.startsAt.toISOString())} -{" "}
                {formatTimeWib(appointment.endsAt.toISOString())} WIB
              </dd>
            </div>

            {/* Notes (if present) */}
            {appointment.notes && (
              <div className="pt-3 flex justify-between items-start gap-4">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#6E6C65] shrink-0">
                  Catatan
                </dt>
                <dd className="text-right text-xs text-[#11110F] italic max-w-xs">
                  &ldquo;{appointment.notes}&rdquo;
                </dd>
              </div>
            )}

            {/* Cancellation Reason (if present) */}
            {appointment.cancellationReason && (
              <div className="pt-3 flex justify-between items-start gap-4">
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#B63D37] shrink-0">
                  Alasan Pembatalan
                </dt>
                <dd className="text-right text-xs text-[#B63D37] max-w-xs">
                  {appointment.cancellationReason}
                </dd>
              </div>
            )}

            {/* Price */}
            <div className="pt-4 flex justify-between items-baseline gap-4 border-t-2 border-[#11110F]">
              <dt className="text-xs font-extrabold uppercase tracking-wider text-[#11110F]">
                Total Biaya
              </dt>
              <dd className="text-xl font-black text-[#11110F]">
                {formatRupiah(appointment.priceRupiah)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Action Controls (e.g. Cancel Appointment for CONFIRMED) */}
        <AppointmentDetailActions
          appointmentId={appointment.id}
          bookingReference={appointment.bookingReference}
          status={appointment.status}
        />
      </div>
    </main>
  );
}
