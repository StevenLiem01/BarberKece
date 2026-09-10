import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDatabaseClient } from "@/lib/db";
import {
  GetAppointmentUseCase,
  GetCustomerAppointmentsUseCase,
  GetServiceUseCase,
} from "@barberkece/core/reservation";
import { GetBarberProfileUseCase } from "@barberkece/core/barber";
import {
  PostgresAppointmentRepository,
  PostgresServiceRepository,
  PostgresBarberProfileRepository,
} from "@barberkece/database/repositories";
import { BookingConfirmationCard } from "@/components/reservation/booking-confirmation-card";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Konfirmasi Reservasi | BarberKece",
  description: "Detail konfirmasi reservasi potong rambut Anda di BarberKece.",
};

interface ConfirmationPageProps {
  params: Promise<{ ref: string }>;
}

export default async function BookingConfirmationPage({
  params,
}: ConfirmationPageProps) {
  const { ref } = await params;

  // 1. Enforce authenticated CUSTOMER role
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/sign-in?next=/book/confirmation/${encodeURIComponent(ref)}`);
  }

  if (user.role !== "CUSTOMER") {
    // Non-CUSTOMER roles (BARBER/ADMIN) must not access customer booking receipts
    notFound();
  }

  // 2. Resolve appointment strictly scoped to authenticated customer via Application Use Cases
  const dbClient = getDatabaseClient();
  const appointmentRepo = new PostgresAppointmentRepository(dbClient.db);
  const getAppointmentUseCase = new GetAppointmentUseCase(appointmentRepo);
  const getCustomerAppointmentsUseCase = new GetCustomerAppointmentsUseCase(
    appointmentRepo,
  );

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);

  let targetAppointment = null;

  if (isUuid) {
    try {
      // Direct lookup with IDOR customerIdContext ownership enforcement in Application layer
      targetAppointment = await getAppointmentUseCase.execute(ref, user.id);
    } catch {
      // Not found or foreign ownership throws AppointmentNotFoundError; fall through safely
    }
  }

  if (!targetAppointment) {
    // Resolve from customer's owned appointments by bookingReference or ID
    const customerAppointments = await getCustomerAppointmentsUseCase.execute(
      user.id,
    );
    const matched = customerAppointments.find(
      (a) => a.bookingReference === ref || a.id === ref,
    );
    if (matched) {
      targetAppointment = matched;
    }
  }

  if (!targetAppointment) {
    // Reference does not exist or belongs to another customer
    notFound();
  }

  // 3. Load catalog details (service and barber) via Application Use Cases
  const serviceRepo = new PostgresServiceRepository(dbClient.db);
  const getServiceUseCase = new GetServiceUseCase(serviceRepo);

  const barberRepo = new PostgresBarberProfileRepository(dbClient.db);
  const getBarberProfileUseCase = new GetBarberProfileUseCase(barberRepo);

  let serviceName = "Layanan Potong Rambut";
  try {
    const service = await getServiceUseCase.execute(
      targetAppointment.serviceId,
    );
    serviceName = service.name;
  } catch {
    // Keep fallback service name if catalog record missing
  }

  let barberSpecialization: string | null = null;
  if (targetAppointment.barberProfileId) {
    try {
      const barber = await getBarberProfileUseCase.execute(
        targetAppointment.barberProfileId,
      );
      barberSpecialization = barber.specialization;
    } catch {
      // Keep null if profile record missing
    }
  }

  return (
    <main className="min-h-screen bg-[#F3F0E8] py-8 sm:py-12 px-4">
      <BookingConfirmationCard
        appointment={{
          id: targetAppointment.id,
          bookingReference: targetAppointment.bookingReference,
          status: targetAppointment.status,
          startsAt: targetAppointment.startsAt.toISOString(),
          endsAt: targetAppointment.endsAt.toISOString(),
          serviceDurationMinutes: targetAppointment.serviceDurationMinutes,
          priceRupiah: targetAppointment.priceRupiah,
          notes: targetAppointment.notes,
          isAutoAssigned: targetAppointment.isAutoAssigned,
        }}
        serviceName={serviceName}
        barberSpecialization={barberSpecialization}
      />
    </main>
  );
}
