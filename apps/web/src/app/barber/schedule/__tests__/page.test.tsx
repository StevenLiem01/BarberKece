import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

const {
  mockRequireRole,
  mockFindByUserId,
  mockGetBarberSchedules,
  mockGetScheduleExceptions,
} = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
  mockFindByUserId: vi.fn(),
  mockGetBarberSchedules: vi.fn(),
  mockGetScheduleExceptions: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  getDatabaseClient: () => ({ db: {} }),
}));

vi.mock("@barberkece/database/repositories", () => ({
  PostgresBarberProfileRepository: class {
    findByUserId = mockFindByUserId;
  },
  PostgresScheduleRepository: class {
    getBarberSchedules = mockGetBarberSchedules;
    getScheduleExceptions = mockGetScheduleExceptions;
  },
}));

import BarberSchedulePage, { metadata } from "../page";

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

describe("BarberSchedulePage (/barber/schedule)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports correct page metadata", () => {
    expect(metadata.title).toContain("Jadwal Saya");
    expect(metadata.description).toContain("jadwal");
  });

  it("should block non-BARBER access", async () => {
    mockRequireRole.mockRejectedValue(new Error("Unauthorized"));

    await expect(BarberSchedulePage()).rejects.toThrow("Unauthorized");
    expect(mockRequireRole).toHaveBeenCalledWith("BARBER");
  });

  it("should render error safely if barber profile is missing", async () => {
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "BARBER" });
    mockFindByUserId.mockResolvedValue(null);

    const component = await BarberSchedulePage();
    const html = renderClean(component);

    expect(mockFindByUserId).toHaveBeenCalledWith("user-1");
    expect(html).toContain("Profil barber belum diatur");
  });

  it("should fetch schedule data securely with correct scoping, ordering, and navigation", async () => {
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "BARBER" });
    mockFindByUserId.mockResolvedValue({ id: "profile-1" });

    mockGetBarberSchedules.mockResolvedValue([
      { id: "sch-1", dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }, // Mon
      { id: "sch-2", dayOfWeek: 1, startTime: "13:00", endTime: "17:00" }, // Mon, multiple periods
      { id: "sch-3", dayOfWeek: 2, startTime: "10:00", endTime: "18:00" }, // Tue
    ]);

    mockGetScheduleExceptions.mockResolvedValue([
      {
        id: "exc-1",
        reason: "Cuti Operasional",
        startsAt: new Date("2026-09-15T09:00:00Z"),
        endsAt: new Date("2026-09-15T17:00:00Z"),
      },
    ]);

    const component = await BarberSchedulePage();
    const html = renderClean(component);

    // Verify own-profile scoping
    expect(mockGetBarberSchedules).toHaveBeenCalledWith("profile-1");

    // Verify exception horizon (approx 14 days)
    const callArgs = mockGetScheduleExceptions.mock.calls[0][0];
    expect(callArgs.barberProfileId).toBe("profile-1");
    expect(callArgs.start).toBeInstanceOf(Date);
    expect(callArgs.end).toBeInstanceOf(Date);
    expect(callArgs.end.getTime() - callArgs.start.getTime()).toBeGreaterThan(
      13 * 24 * 60 * 60 * 1000,
    );

    // Verify UI headings and content
    expect(html).toContain("Jadwal Saya");
    expect(html).toContain("Jadwal Reguler");
    expect(html).toContain("Senin");
    expect(html).toContain("Selasa");
    expect(html).toContain("Rabu"); // Renders Libur for days with no periods
    expect(html).toContain("Libur");

    // Multiple periods per day correctly ordered
    expect(html).toContain("09:00 - 12:00");
    expect(html).toContain("13:00 - 17:00");

    // Exceptions
    expect(html).toContain("Cuti Operasional");

    // Navigation links present
    expect(html).toContain('href="/barber"');
    expect(html).toContain('href="/barber/appointments"');
    expect(html).toContain("Workspace Hari Ini");
    expect(html).toContain("Semua Janji Temu");
  });

  it("should render empty state for exceptions if none exist, and contain no edit controls", async () => {
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "BARBER" });
    mockFindByUserId.mockResolvedValue({ id: "profile-1" });
    mockGetBarberSchedules.mockResolvedValue([]);
    mockGetScheduleExceptions.mockResolvedValue([]);

    const component = await BarberSchedulePage();
    const html = renderClean(component);

    expect(html).toContain(
      "Tidak ada pengecualian jadwal atau libur dalam 14 hari ke depan.",
    );

    // Ensure purely read-only: no edit or save buttons
    expect(html).not.toContain("Simpan");
    expect(html).not.toContain("Edit Jadwal");
    expect(html).not.toContain("Tambah Jadwal");
  });
});
