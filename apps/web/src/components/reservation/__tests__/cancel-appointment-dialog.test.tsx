import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  AppointmentDetailActions,
  CancelAppointmentDialog,
  isCancellationEligible,
  mapCancellationErrorMessage,
  executeCancellationRequest,
} from "../cancel-appointment-dialog";

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

describe("CancelAppointment - Eligibility & Helper Functions", () => {
  it("allows cancellation only for CONFIRMED status", () => {
    expect(isCancellationEligible("CONFIRMED")).toBe(true);

    const nonEligible = [
      "CHECKED_IN",
      "IN_SERVICE",
      "COMPLETED",
      "CANCELLED_BY_CUSTOMER",
      "CANCELLED_BY_BARBERSHOP",
      "NO_SHOW",
    ];

    for (const status of nonEligible) {
      expect(isCancellationEligible(status)).toBe(false);
    }
  });

  describe("mapCancellationErrorMessage", () => {
    it("maps 401/403 to session expiration message", () => {
      expect(mapCancellationErrorMessage(401)).toContain(
        "Sesi Anda telah berakhir",
      );
      expect(mapCancellationErrorMessage(403)).toContain(
        "Sesi Anda telah berakhir",
      );
    });

    it("maps 404 to not found/no access message", () => {
      expect(mapCancellationErrorMessage(404)).toContain(
        "Janji temu tidak ditemukan",
      );
    });

    it("maps cutoff error to truthful cutoff message without hardcoding duration", () => {
      const msg = mapCancellationErrorMessage(400, {
        message:
          "Cancellation cutoff exceeded for appointment scheduled at 2026-09-15T10:00:00.000Z",
      });
      expect(msg).toBe("Batas waktu pembatalan mandiri telah terlewati.");
      expect(msg).not.toContain("2 jam");
      expect(msg).not.toContain("CancellationCutoffExceededError");
    });

    it("maps invalid status transition error to status changed friendly message", () => {
      const msg = mapCancellationErrorMessage(400, {
        message:
          "Cannot transition appointment status from IN_SERVICE to CANCELLED_BY_CUSTOMER",
      });
      expect(msg).toContain("Status janji temu telah berubah");
      expect(msg).not.toContain("InvalidAppointmentStatusTransitionError");
    });

    it("maps other 400 errors safely", () => {
      const msg = mapCancellationErrorMessage(400, {
        message: "Some weird internal validation error",
      });
      expect(msg).toContain("Permintaan pembatalan tidak dapat diproses");
      expect(msg).not.toContain("weird internal");
    });

    it("maps 500 or unknown errors to generic safe server message", () => {
      const msg = mapCancellationErrorMessage(500);
      expect(msg).toContain("Terjadi kesalahan pada sistem");
    });
  });
});

describe("AppointmentDetailActions Component Rendering", () => {
  const defaultProps = {
    appointmentId: "app-uuid-1",
    bookingReference: "BK-20260915-001",
    status: "CONFIRMED",
  };

  it("renders 'Batalkan Reservasi' button for CONFIRMED appointment", () => {
    const html = renderClean(<AppointmentDetailActions {...defaultProps} />);
    expect(html).toContain("Batalkan Reservasi");
    expect(html).toContain('data-testid="cancel-appointment-button"');
  });

  it("does NOT render cancel CTA for any of the 6 non-CONFIRMED statuses", () => {
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
        <AppointmentDetailActions {...defaultProps} status={status} />,
      );
      expect(html).toBe("");
      expect(html).not.toContain("Batalkan Reservasi");
    }
  });
});

describe("CancelAppointmentDialog Rendering & Accessibility", () => {
  const defaultDialogProps = {
    isOpen: true,
    onClose: vi.fn(),
    appointmentId: "app-uuid-1",
    bookingReference: "BK-20260915-001",
    onSuccess: vi.fn(),
  };

  it("renders nothing when isOpen is false", () => {
    const html = renderClean(
      <CancelAppointmentDialog {...defaultDialogProps} isOpen={false} />,
    );
    expect(html).toBe("");
  });

  it("renders accessible dialog attributes and content when isOpen is true", () => {
    const html = renderClean(
      <CancelAppointmentDialog {...defaultDialogProps} isOpen={true} />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');

    // Dynamic unique ID linkage via useId
    const titleMatch = html.match(/aria-labelledby="([^"]+)"/);
    expect(titleMatch).toBeTruthy();
    expect(html).toContain(`id="${titleMatch![1]}"`);

    const descMatch = html.match(/aria-describedby="([^"]+)"/);
    expect(descMatch).toBeTruthy();
    expect(html).toContain(`id="${descMatch![1]}"`);

    expect(html).toContain("Batalkan Janji Temu?");
    expect(html).toContain("BK-20260915-001");
    expect(html).toContain("Alasan Pembatalan");
    expect(html).toContain("Kembali");
    expect(html).toContain("Ya, Batalkan Reservasi");
  });

  it("uses semantic error styling for destructive button and not Acid Lime", () => {
    const html = renderClean(
      <CancelAppointmentDialog {...defaultDialogProps} isOpen={true} />,
    );

    // Destructive button uses #B63D37 (semantic red)
    expect(html).toContain("bg-[#B63D37]");
    // Does NOT use #C9F23B (Acid Lime) for destructive action
    expect(html).not.toContain("bg-[#C9F23B]");
  });
});

describe("executeCancellationRequest HTTP Mutation & Payloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls correct endpoint and sends empty payload when reason is empty or whitespace", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: "app-uuid-1", status: "CANCELLED_BY_CUSTOMER" },
      }),
    });

    const result = await executeCancellationRequest(
      "app-uuid-1",
      "   ",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/appointments/app-uuid-1/cancel",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
  });

  it("sends trimmed reason payload when reason is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: "app-uuid-1", status: "CANCELLED_BY_CUSTOMER" },
      }),
    });

    const result = await executeCancellationRequest(
      "app-uuid-1",
      "  Ada urusan mendadak  ",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/appointments/app-uuid-1/cancel",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Ada urusan mendadak" }),
      },
    );
  });

  it("returns safe friendly cutoff error message when backend returns 400 cutoff exceeded", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: "BAD_REQUEST",
          message:
            "Cancellation cutoff exceeded for appointment scheduled at 2026-09-15T10:00:00.000Z",
        },
      }),
    });

    const result = await executeCancellationRequest(
      "app-uuid-1",
      "",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toBe(
        "Batas waktu pembatalan mandiri telah terlewati.",
      );
      expect(result.errorMessage).not.toContain("2 jam");
    }
  });

  it("returns safe friendly state changed message with isStaleStatus flag when backend returns status transition error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: "BAD_REQUEST",
          message:
            "Cannot transition appointment status from IN_SERVICE to CANCELLED_BY_CUSTOMER",
        },
      }),
    });

    const result = await executeCancellationRequest(
      "app-uuid-1",
      "",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("Status janji temu telah berubah");
      expect(result.isStaleStatus).toBe(true);
    }
  });

  it("truncates reason payload to 500 characters max even when called programmatically", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: "app-uuid-1", status: "CANCELLED_BY_CUSTOMER" },
      }),
    });

    const longReason = "A".repeat(600);
    const result = await executeCancellationRequest(
      "app-uuid-1",
      longReason,
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/appointments/app-uuid-1/cancel",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "A".repeat(500) }),
      },
    );
  });

  it("returns safe session expired message when backend returns 401 or 403", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      }),
    });

    const result = await executeCancellationRequest(
      "app-uuid-1",
      "",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("Sesi Anda telah berakhir");
    }
  });

  it("handles network error gracefully without crashing", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await executeCancellationRequest(
      "app-uuid-1",
      "",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toContain("Gagal terhubung ke server");
    }
  });
});
