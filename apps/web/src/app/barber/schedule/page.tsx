import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getDatabaseClient } from "@/lib/db";
import { PostgresBarberProfileRepository } from "@barberkece/database/repositories";
import { GetBarberScheduleViewer } from "@barberkece/core/reservation";
import { PostgresScheduleRepository } from "@barberkece/database/repositories";
import { BarberScheduleViewer } from "@/components/barber/barber-schedule-viewer";
import {
  toBarberScheduleViewerDto,
  toScheduleExceptionDto,
} from "@barberkece/contracts";

export const metadata: Metadata = {
  title: "Jadwal Saya | BarberKece",
  description: "Lihat jadwal reguler dan pengecualian libur.",
};

export default async function BarberSchedulePage() {
  const user = await requireRole("BARBER");

  const dbClient = getDatabaseClient();
  const barberProfileRepo = new PostgresBarberProfileRepository(dbClient.db);

  const barberProfile = await barberProfileRepo.findByUserId(user.id);

  if (!barberProfile) {
    return (
      <main className="min-h-screen bg-[#F3F0E8] py-6 sm:py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-6 text-center text-[#D97706]">
            <p>Profil barber belum diatur. Silakan hubungi admin.</p>
          </div>
        </div>
      </main>
    );
  }

  const scheduleRepo = new PostgresScheduleRepository(dbClient.db);
  const useCase = new GetBarberScheduleViewer(scheduleRepo);

  // Use a 14-day horizon as an implementation choice to bound the exception query
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const { schedules, exceptions } = await useCase.execute({
    barberProfileId: barberProfile.id,
    horizonEnd,
  });

  return (
    <main className="min-h-screen bg-[#F3F0E8] py-6 sm:py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <BarberScheduleViewer
          schedules={schedules.map(toBarberScheduleViewerDto)}
          exceptions={exceptions.map(toScheduleExceptionDto)}
        />
      </div>
    </main>
  );
}
