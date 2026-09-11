"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppointmentCard, AppointmentCardData } from "./appointment-card";
import { CalendarIcon, ClockIcon } from "@/components/ui/icons";

export interface AppointmentsListViewProps {
  appointments: AppointmentCardData[];
  initialNow?: number;
}

/**
 * Pure presentation-only classification:
 * An appointment is 'Upcoming' if it has an active status and its scheduled end time is in the future.
 * Resolved/terminal states (COMPLETED, CANCELLED_*, NO_SHOW) or expired appointments belong to 'History'.
 */
export function isUpcomingAppointment(
  appointment: { status: string; endsAt: string | Date },
  now = Date.now(),
): boolean {
  const isTerminal =
    appointment.status === "COMPLETED" ||
    appointment.status === "CANCELLED_BY_CUSTOMER" ||
    appointment.status === "CANCELLED_BY_BARBERSHOP" ||
    appointment.status === "NO_SHOW";

  if (isTerminal) {
    return false;
  }

  // Operational in-progress statuses (CHECKED_IN, IN_SERVICE) remain active/upcoming
  // even if scheduled endsAt has passed, until marked COMPLETED or cancelled.
  if (
    appointment.status === "CHECKED_IN" ||
    appointment.status === "IN_SERVICE"
  ) {
    return true;
  }

  const endTime =
    appointment.endsAt instanceof Date
      ? appointment.endsAt.getTime()
      : new Date(appointment.endsAt).getTime();

  return endTime > now;
}

export function AppointmentsListView({
  appointments,
  initialNow,
}: AppointmentsListViewProps) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">(
    "upcoming",
  );
  const [currentNow] = useState(() => initialNow ?? Date.now());
  const now = initialNow ?? currentNow;

  const upcomingTabRef = React.useRef<HTMLButtonElement>(null);
  const historyTabRef = React.useRef<HTMLButtonElement>(null);

  const upcomingAppointments = appointments
    .filter((a) => isUpcomingAppointment(a, now))
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
        a.id.localeCompare(b.id),
    );

  const pastAppointments = appointments
    .filter((a) => !isUpcomingAppointment(a, now))
    .sort(
      (a, b) =>
        new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime() ||
        b.id.localeCompare(a.id),
    );

  // Global empty state: customer has never booked an appointment
  if (appointments.length === 0) {
    return (
      <div
        data-testid="appointments-empty-state"
        className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-8 sm:p-12 text-center shadow-xs space-y-4"
      >
        <div className="h-16 w-16 bg-[#11110F]/5 border border-[#D8D4CA] rounded-full flex items-center justify-center mx-auto text-[#11110F]">
          <CalendarIcon size={32} />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h2 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-[#11110F]">
            Belum Ada Reservasi
          </h2>
          <p className="text-xs sm:text-sm text-[#6E6C65]">
            Anda belum memiliki jadwal reservasi. Jadwalkan potong rambut
            bersama barber profesional kami sekarang.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/book"
            className="inline-flex items-center justify-center px-6 py-3 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#22231F] focus:outline-none focus:ring-2 focus:ring-[#C9F23B]"
          >
            Pesan Sekarang
          </Link>
        </div>
      </div>
    );
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    current: "upcoming" | "history",
  ) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const target = current === "upcoming" ? "history" : "upcoming";
      setActiveTab(target);
      if (target === "upcoming") {
        upcomingTabRef.current?.focus();
      } else {
        historyTabRef.current?.focus();
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveTab("upcoming");
      upcomingTabRef.current?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveTab("history");
      historyTabRef.current?.focus();
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Filter Janji Temu"
        className="flex items-center gap-2 p-1.5 bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl w-fit"
      >
        <button
          ref={upcomingTabRef}
          type="button"
          role="tab"
          id="tab-upcoming"
          tabIndex={activeTab === "upcoming" ? 0 : -1}
          aria-selected={activeTab === "upcoming"}
          aria-controls="panel-upcoming"
          onClick={() => setActiveTab("upcoming")}
          onKeyDown={(e) => handleKeyDown(e, "upcoming")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9F23B] ${
            activeTab === "upcoming"
              ? "bg-[#11110F] text-[#FAF8F3] shadow-xs"
              : "text-[#6E6C65] hover:text-[#11110F]"
          }`}
        >
          Mendatang ({upcomingAppointments.length})
        </button>

        <button
          ref={historyTabRef}
          type="button"
          role="tab"
          id="tab-history"
          tabIndex={activeTab === "history" ? 0 : -1}
          aria-selected={activeTab === "history"}
          aria-controls="panel-history"
          onClick={() => setActiveTab("history")}
          onKeyDown={(e) => handleKeyDown(e, "history")}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9F23B] ${
            activeTab === "history"
              ? "bg-[#11110F] text-[#FAF8F3] shadow-xs"
              : "text-[#6E6C65] hover:text-[#11110F]"
          }`}
        >
          Riwayat ({pastAppointments.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "upcoming" && (
        <div
          role="tabpanel"
          id="panel-upcoming"
          aria-labelledby="tab-upcoming"
          className="space-y-4"
        >
          {upcomingAppointments.length === 0 ? (
            <div
              data-testid="upcoming-empty-state"
              className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-8 text-center space-y-3 shadow-xs"
            >
              <div className="h-12 w-12 bg-[#11110F]/5 border border-[#D8D4CA] rounded-full flex items-center justify-center mx-auto text-[#11110F]">
                <CalendarIcon size={24} />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-sm sm:text-base font-bold uppercase tracking-tight text-[#11110F]">
                  Tidak Ada Janji Temu Mendatang
                </h3>
                <p className="text-xs text-[#6E6C65]">
                  Anda tidak memiliki jadwal potong rambut yang akan datang.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center px-4 py-2 bg-[#11110F] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider rounded-xl transition-colors hover:bg-[#22231F]"
                >
                  Pesan Janji Temu
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div
          role="tabpanel"
          id="panel-history"
          aria-labelledby="tab-history"
          className="space-y-4"
        >
          {pastAppointments.length === 0 ? (
            <div
              data-testid="history-empty-state"
              className="bg-[#FAF8F3] border border-[#D8D4CA] rounded-2xl p-8 text-center space-y-3 shadow-xs"
            >
              <div className="h-12 w-12 bg-[#11110F]/5 border border-[#D8D4CA] rounded-full flex items-center justify-center mx-auto text-[#11110F]">
                <ClockIcon size={24} />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-sm sm:text-base font-bold uppercase tracking-tight text-[#11110F]">
                  Belum Ada Riwayat Kunjungan
                </h3>
                <p className="text-xs text-[#6E6C65]">
                  Riwayat janji temu yang telah selesai atau dibatalkan akan
                  tercatat di sini.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
