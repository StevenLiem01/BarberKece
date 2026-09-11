import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  RescheduleAppointmentDialog,
  RescheduleAppointmentDialogProps,
  isRescheduleEligible,
  mapRescheduleErrorMessage,
  fetchAvailableSlots,
  executeRescheduleRequest,
  isSameInstant,
  toJakartaDateString,
  getJakartaTodayString,
  addJakartaDays,
} from "../reschedule-appointment-dialog";
import { AppointmentDetailActions } from "../cancel-appointment-dialog";

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

// Mock router
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

describe("RescheduleAppointment - Eligibility & Helper Functions", () => {
  it("allows rescheduling ONLY for CONFIRMED status with a valid barberProfileId", () => {
    expect(isRescheduleEligible("CONFIRMED", "barber-uuid-1")).toBe(true);
  });

  it("blocks rescheduling for all 6 non-CONFIRMED statuses", () => {
    const nonEligible = [
      "CHECKED_IN",
      "IN_SERVICE",
      "COMPLETED",
      "CANCELLED_BY_CUSTOMER",
      "CANCELLED_BY_BARBERSHOP",
      "NO_SHOW",
    ];

    for (const status of nonEligible) {
      expect(isRescheduleEligible(status, "barber-uuid-1")).toBe(false);
    }
  });

  it("safely blocks reschedule when barberProfileId is unexpectedly absent, null, or empty", () => {
    expect(isRescheduleEligible("CONFIRMED", null)).toBe(false);
    expect(isRescheduleEligible("CONFIRMED", undefined)).toBe(false);
    expect(isRescheduleEligible("CONFIRMED", "")).toBe(false);
  });

  describe("mapRescheduleErrorMessage", () => {
    it("maps 401/403 to session expired message", () => {
      const res401 = mapRescheduleErrorMessage(401);
      expect(res401.message).toContain("Sesi Anda telah berakhir");

      const res403 = mapRescheduleErrorMessage(403);
      expect(res403.message).toContain("Sesi Anda telah berakhir");
    });

    it("maps 404 to not found/no access message", () => {
      const res = mapRescheduleErrorMessage(404);
      expect(res.message).toContain("Janji temu tidak ditemukan");
    });

    it("maps cutoff error to truthful generic cutoff message without hardcoding hours", () => {
      const res = mapRescheduleErrorMessage(400, {
        message:
          "Reschedule cutoff exceeded for appointment scheduled at 2026-09-15T10:00:00.000Z",
      });
      expect(res.message).toContain(
        "Batas waktu perubahan jadwal mandiri telah terlewati.",
      );
      expect(res.message).not.toContain("2 jam");
      expect(res.message).not.toContain("24 jam");
    });

    it("maps status transition error to state changed message with isStaleStatus flag", () => {
      const res = mapRescheduleErrorMessage(400, {
        message:
          "Cannot transition appointment status from IN_SERVICE to CONFIRMED",
      });
      expect(res.message).toContain("Status janji temu telah berubah");
      expect(res.isStaleStatus).toBe(true);
      expect(res.message).not.toContain(
        "InvalidAppointmentStatusTransitionError",
      );
    });

    it("maps already booked or conflict error to stale slot message with isStaleSlot flag", () => {
      const conflicts = [
        "SlotAlreadyBookedError: Selected slot is already booked",
        "CustomerBookingConflictError: Customer already has a booking",
        "BarberNotWorkingError: Barber is not scheduled to work",
        "ScheduleExceptionConflictError: Barber has time off",
      ];

      for (const msg of conflicts) {
        const res = mapRescheduleErrorMessage(400, { message: msg });
        expect(res.message).toContain(
          "Waktu yang dipilih sudah tidak tersedia lagi karena baru saja dipesan.",
        );
        expect(res.isStaleSlot).toBe(true);
      }
    });

    it("maps outside business hours or horizon errors safely", () => {
      const res = mapRescheduleErrorMessage(400, {
        message: "OutsideBusinessHoursError: Selected time is outside hours",
      });
      expect(res.message).toContain("di luar jam operasional");
    });

    it("maps 500 or unknown errors to generic safe server message", () => {
      const res = mapRescheduleErrorMessage(500);
      expect(res.message).toContain("Terjadi kesalahan pada sistem");
      expect(res.message).not.toContain("PostgresError");
    });
  });
});

describe("fetchAvailableSlots - Truthful Same-Barber Guarantee", () => {
  it("requests availability specifically for the given barberProfileId and never Any Barber", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            startsAt: "2026-09-16T03:00:00.000Z",
            endsAt: "2026-09-16T03:45:00.000Z",
          },
        ],
      }),
    });

    const result = await fetchAvailableSlots(
      "srv-uuid-1",
      "barber-uuid-1",
      "2026-09-16",
      { fetchFn: mockFetch as unknown as typeof fetch },
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/v1/appointments/available-slots");
    expect(calledUrl).toContain("serviceId=srv-uuid-1");
    expect(calledUrl).toContain("date=2026-09-16");
    expect(calledUrl).toContain("barberProfileId=barber-uuid-1");
    expect(calledUrl).not.toContain("barberProfileId=ANY");
  });

  it("safely blocks availability request when barberProfileId is empty", async () => {
    const mockFetch = vi.fn();
    const result = await fetchAvailableSlots("srv-uuid-1", "", "2026-09-16", {
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
    if (!result.success) {
      expect(result.errorMessage).toContain("Barber tidak valid");
    }
  });

  it("handles HTTP error from availability endpoint gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await fetchAvailableSlots(
      "srv-uuid-1",
      "barber-uuid-1",
      "2026-09-16",
      { fetchFn: mockFetch as unknown as typeof fetch },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("Gagal memuat jadwal tersedia");
    }
  });

  it("handles network failure gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError("Network down"));

    const result = await fetchAvailableSlots(
      "srv-uuid-1",
      "barber-uuid-1",
      "2026-09-16",
      { fetchFn: mockFetch as unknown as typeof fetch },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("Gagal terhubung ke server");
    }
  });
});

describe("executeRescheduleRequest HTTP Mutation & Payloads", () => {
  it("calls correct endpoint and sends exact newStartsAt payload", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "app-uuid-1",
          status: "CONFIRMED",
          startsAt: "2026-09-16T04:00:00.000Z",
        },
      }),
    });

    const result = await executeRescheduleRequest(
      "app-uuid-1",
      "2026-09-16T04:00:00.000Z",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/appointments/app-uuid-1/reschedule",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStartsAt: "2026-09-16T04:00:00.000Z" }),
      },
    );
  });

  it("returns conflict error with isStaleSlot flag when slot was booked by someone else", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: "BAD_REQUEST",
          message:
            "SlotAlreadyBookedError: The selected slot is already booked",
        },
      }),
    });

    const result = await executeRescheduleRequest(
      "app-uuid-1",
      "2026-09-16T04:00:00.000Z",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.isStaleSlot).toBe(true);
      expect(result.errorMessage).toContain("sudah tidak tersedia lagi");
    }
  });

  it("returns cutoff exceeded error safely", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: "BAD_REQUEST",
          message: "RescheduleCutoffExceededError: Cutoff passed",
        },
      }),
    });

    const result = await executeRescheduleRequest(
      "app-uuid-1",
      "2026-09-16T04:00:00.000Z",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain(
        "Batas waktu perubahan jadwal mandiri telah terlewati.",
      );
    }
  });

  it("handles network error gracefully without crashing", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError("Network error"));

    const result = await executeRescheduleRequest(
      "app-uuid-1",
      "2026-09-16T04:00:00.000Z",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("Gagal terhubung ke server");
    }
  });
});

describe("RescheduleAppointmentDialog Rendering & Accessibility", () => {
  const defaultDialogProps: RescheduleAppointmentDialogProps = {
    isOpen: true,
    onClose: vi.fn(),
    appointmentId: "app-uuid-1",
    bookingReference: "BK-20260915-001",
    serviceId: "srv-uuid-1",
    serviceName: "Gentlemen Classic Cut",
    barberProfileId: "barber-uuid-1",
    barberName: "Senior Stylist",
    currentStartsAt: "2026-09-15T03:00:00.000Z",
    currentEndsAt: "2026-09-15T03:45:00.000Z",
    serviceDurationMinutes: 45,
    onSuccess: vi.fn(),
  };

  it("renders nothing when isOpen is false", () => {
    const html = renderClean(
      <RescheduleAppointmentDialog {...defaultDialogProps} isOpen={false} />,
    );
    expect(html).toBe("");
  });

  it("renders accessible dialog attributes and content when isOpen is true", () => {
    const html = renderClean(
      <RescheduleAppointmentDialog {...defaultDialogProps} isOpen={true} />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');

    // Linkage IDs
    const titleMatch = html.match(/aria-labelledby="([^"]+)"/);
    expect(titleMatch).toBeTruthy();
    expect(html).toContain(`id="${titleMatch![1]}"`);

    const descMatch = html.match(/aria-describedby="([^"]+)"/);
    expect(descMatch).toBeTruthy();
    expect(html).toContain(`id="${descMatch![1]}"`);

    // Headers & Labels
    expect(html).toContain("Ubah Jadwal Janji Temu");
    expect(html).toContain("BK-20260915-001");
    expect(html).toContain("Jadwal Saat Ini");
    expect(html).toContain("Jadwal Baru yang Dipilih");
    expect(html).toContain("Pilih Tanggal Baru");
    expect(html).toContain("Pilih Waktu Tersedia");
    expect(html).toContain("Senior Stylist");
    expect(html).toContain("Konfirmasi Ubah Jadwal");
    expect(html).toContain("Batal");
  });

  it("opening dialog does NOT mutate state or trigger reschedule POST request", () => {
    const mockFetch = vi.fn();
    renderClean(
      <RescheduleAppointmentDialog
        {...defaultDialogProps}
        isOpen={true}
        fetchFn={mockFetch as unknown as typeof fetch}
      />,
    );

    // Opening does NOT send POST reschedule mutation
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/reschedule"),
      expect.anything(),
    );
  });

  it("propagates AbortError when AbortSignal is aborted to prevent stale request races", async () => {
    const abortController = new AbortController();
    abortController.abort();

    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      if (init?.signal?.aborted) {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    });

    await expect(
      fetchAvailableSlots("srv-uuid-1", "barber-uuid-1", "2026-09-16", {
        signal: abortController.signal,
        fetchFn: mockFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow("aborted");
  });

  it("renders disabled state on confirm button by default before a slot is selected", () => {
    const html = renderClean(
      <RescheduleAppointmentDialog {...defaultDialogProps} isOpen={true} />,
    );

    expect(html).toContain('data-testid="confirm-reschedule-button"');
    expect(html).toMatch(
      /<button[^>]*data-testid="confirm-reschedule-button"[^>]*disabled/,
    );
  });

  it("uses native radio inputs inside labels for quick dates and time slots ensuring keyboard accessibility", () => {
    const html = renderClean(
      <RescheduleAppointmentDialog {...defaultDialogProps} isOpen={true} />,
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Pilihan Tanggal Cepat"');
    expect(html).toContain('type="radio"');
    expect(html).toContain('name="reschedule-quick-date"');
  });

  it("does not artificially cap future dates on the native date picker and labels quick dates truthfully", () => {
    const html = renderClean(
      <RescheduleAppointmentDialog {...defaultDialogProps} isOpen={true} />,
    );

    expect(html).toContain('aria-label="Pilihan Tanggal Cepat"');
    expect(html).not.toContain("hanya tersedia 14 hari");
    expect(html).not.toContain("batas reservasi 14 hari");

    // Native date input has min attribute set to Jakarta today without artificial max capping
    const todayJakarta = getJakartaTodayString();
    expect(html).toContain(`min="${todayJakarta}"`);
    expect(html).not.toMatch(/id="reschedule-date-input"[^>]*max=/);
  });
});

describe("Jakarta Date Semantics & Instant Comparison", () => {
  it("toJakartaDateString derives correct calendar date across UTC day rollovers", () => {
    // 18:00 UTC on 2026-09-15 is 01:00 AM on 2026-09-16 in Asia/Jakarta (UTC+7)
    const rolledOverDate = toJakartaDateString("2026-09-15T18:00:00.000Z");
    expect(rolledOverDate).toBe("2026-09-16");

    // 03:00 UTC on 2026-09-15 is 10:00 AM on 2026-09-15 in Asia/Jakarta (UTC+7)
    const sameDayDate = toJakartaDateString("2026-09-15T03:00:00.000Z");
    expect(sameDayDate).toBe("2026-09-15");
  });

  it("addJakartaDays performs pure calendar addition in UTC handling month transitions cleanly", () => {
    expect(addJakartaDays("2026-09-15", 3)).toBe("2026-09-18");
    // Month rollover (September has 30 days)
    expect(addJakartaDays("2026-09-30", 1)).toBe("2026-10-01");
    // Year rollover
    expect(addJakartaDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("isSameInstant correctly compares UTC instants across different string ISO representations", () => {
    expect(
      isSameInstant("2026-09-15T03:00:00.000Z", "2026-09-15T03:00:00Z"),
    ).toBe(true);

    expect(
      isSameInstant("2026-09-15T03:00:00.000Z", "2026-09-15T04:00:00.000Z"),
    ).toBe(false);

    expect(isSameInstant(null, "2026-09-15T03:00:00.000Z")).toBe(false);
  });

  it("mapRescheduleErrorMessage maps unrecognized 400 safely to generic message without setting isStaleSlot", () => {
    const res = mapRescheduleErrorMessage(400, {
      message: "UnrecognizedDomainConstraintError: internal detail",
    });

    expect(res.message).toBe(
      "Permintaan perubahan jadwal tidak dapat diproses. Silakan periksa kembali jadwal Anda.",
    );
    expect(res.isStaleSlot).toBeFalsy();
    expect(res.isStaleStatus).toBeFalsy();
    expect(res.message).not.toContain("UnrecognizedDomainConstraintError");
  });
});

describe("AppointmentDetailActions Coexistence Rendering", () => {
  const fullProps = {
    appointmentId: "app-uuid-1",
    bookingReference: "BK-20260915-001",
    status: "CONFIRMED",
    serviceId: "srv-uuid-1",
    serviceName: "Gentlemen Classic Cut",
    barberProfileId: "barber-uuid-1",
    barberName: "Senior Stylist",
    currentStartsAt: "2026-09-15T03:00:00.000Z",
    currentEndsAt: "2026-09-15T03:45:00.000Z",
    serviceDurationMinutes: 45,
  };

  it("renders BOTH 'Ubah Jadwal' and 'Batalkan Reservasi' for CONFIRMED appointment with assigned barber", () => {
    const html = renderClean(<AppointmentDetailActions {...fullProps} />);
    expect(html).toContain("Ubah Jadwal");
    expect(html).toContain('data-testid="reschedule-appointment-button"');
    expect(html).toContain("Batalkan Reservasi");
    expect(html).toContain('data-testid="cancel-appointment-button"');
  });

  it("renders ONLY 'Batalkan Reservasi' and blocks 'Ubah Jadwal' when barberProfileId is absent", () => {
    const html = renderClean(
      <AppointmentDetailActions {...fullProps} barberProfileId={null} />,
    );
    expect(html).toContain("Batalkan Reservasi");
    expect(html).not.toContain("Ubah Jadwal");
    expect(html).not.toContain('data-testid="reschedule-appointment-button"');
  });

  it("renders NOTHING for all 6 non-CONFIRMED statuses", () => {
    const nonEligible = [
      "CHECKED_IN",
      "IN_SERVICE",
      "COMPLETED",
      "CANCELLED_BY_CUSTOMER",
      "CANCELLED_BY_BARBERSHOP",
      "NO_SHOW",
    ];

    for (const status of nonEligible) {
      const html = renderClean(
        <AppointmentDetailActions {...fullProps} status={status} />,
      );
      expect(html).toBe("");
      expect(html).not.toContain("Ubah Jadwal");
      expect(html).not.toContain("Batalkan Reservasi");
    }
  });
});
