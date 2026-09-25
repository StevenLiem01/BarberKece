/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { AdminBarberDto } from "@barberkece/contracts";
import AdminBarbersPage, { metadata } from "../page";
import {
  AdminBarbersRecovery,
  validateBarberDisplayName,
} from "@/components/admin/admin-barbers-recovery";

// React act environment flag
// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

function makeBarber(overrides: Partial<AdminBarberDto> = {}): AdminBarberDto {
  return {
    id: "barber-uuid-1",
    userId: "user-uuid-1",
    displayName: "Budi Santoso",
    specialization: "Fade & Pompadour",
    missingDisplayName: false,
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Admin Barber Name Recovery UI (/admin/barbers)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const renderComponent = async (element: React.ReactElement) => {
    await act(async () => {
      root.render(element);
    });
  };

  describe("Validation Rules (validateBarberDisplayName)", () => {
    it("rejects empty or whitespace-only names", () => {
      const resEmpty = validateBarberDisplayName("");
      expect(resEmpty.isValid).toBe(false);
      expect(resEmpty.error).toContain("wajib diisi");

      const resWhitespace = validateBarberDisplayName("    ");
      expect(resWhitespace.isValid).toBe(false);
      expect(resWhitespace.error).toContain("hanya berisi spasi");
    });

    it("rejects non-string values", () => {
      // @ts-expect-error Testing invalid runtime types
      const resNull = validateBarberDisplayName(null);
      expect(resNull.isValid).toBe(false);
    });

    it("rejects names exceeding 100 characters", () => {
      const longName = "A".repeat(101);
      const resLong = validateBarberDisplayName(longName);
      expect(resLong.isValid).toBe(false);
      expect(resLong.error).toContain("100 karakter");
    });

    it("accepts and trims valid names between 1 and 100 characters", () => {
      const resValid = validateBarberDisplayName("  Ahmad Dahlan  ");
      expect(resValid.isValid).toBe(true);
      expect(resValid.cleanName).toBe("Ahmad Dahlan");
      expect(resValid.error).toBeUndefined();
    });
  });

  describe("Page Metadata & Structure", () => {
    it("exports correct page metadata with title and description", () => {
      expect(metadata.title).toContain("Kelola & Pemulihan Barber");
      expect(metadata.description).toContain("kelengkapan nama");
    });

    it("renders page header and back link to /admin", () => {
      const html = renderClean(<AdminBarbersPage />);
      expect(html).toContain("Kelola &amp; Pemulihan Barber");
      expect(html).toContain("Kembali ke Dashboard Admin");
      expect(html).toContain('href="/admin"');
    });

    it("renders both barber invitation form and barber recovery section", () => {
      const html = renderClean(<AdminBarbersPage />);
      expect(html).toContain("Undang Barber Baru");
      expect(html).toContain("Kirim Undangan Barber");
      expect(html).toContain("Ringkasan Staf Barber");
    });
  });

  describe("Display States & Warnings", () => {
    it("renders empty state when no barbers exist", () => {
      const html = renderClean(<AdminBarbersRecovery initialBarbers={[]} />);
      expect(html).toContain('data-testid="empty-state"');
      expect(html).toContain("Belum Ada Data Staf Barber");
    });

    it("renders prominent warning for unnamed barbers (missingDisplayName = true)", () => {
      const unnamedBarber = makeBarber({
        id: "unnamed-1",
        displayName: null,
        missingDisplayName: true,
      });

      const html = renderClean(
        <AdminBarbersRecovery initialBarbers={[unnamedBarber]} />,
      );

      // Warning alert for public discovery/booking exclusion
      expect(html).toContain('role="alert"');
      expect(html).toContain(
        "PERINGATAN: Barber ini belum memiliki nama lengkap",
      );
      expect(html).toContain("disembunyikan");
      expect(html).toContain("sistem booking");

      // Card badges and indicators
      expect(html).toContain('data-testid="badge-unnamed-unnamed-1"');
      expect(html).toContain("Perlu Pemulihan Nama");
      expect(html).toContain("(Nama Belum Diatur)");
      expect(html).toContain("Lengkapi Nama");
    });

    it("renders active badge and no warning for named barbers", () => {
      const namedBarber = makeBarber({
        id: "named-1",
        displayName: "Joko Anwar",
        missingDisplayName: false,
      });

      const html = renderClean(
        <AdminBarbersRecovery initialBarbers={[namedBarber]} />,
      );

      expect(html).not.toContain(
        "PERINGATAN: Barber ini belum memiliki nama lengkap",
      );
      expect(html).toContain('data-testid="badge-active-named-1"');
      expect(html).toContain("Nama Lengkap");
      expect(html).toContain("Joko Anwar");
      expect(html).toContain("Ubah Nama");
    });

    it("renders statistics summary reflecting total and unnamed barbers count", () => {
      const barbers = [
        makeBarber({
          id: "b1",
          displayName: "Barber Satu",
          missingDisplayName: false,
        }),
        makeBarber({ id: "b2", displayName: null, missingDisplayName: true }),
      ];

      const html = renderClean(
        <AdminBarbersRecovery initialBarbers={barbers} />,
      );

      expect(html).toContain("Ringkasan Staf Barber");
      expect(html).toContain("Total Barber Terdaftar");
      expect(html).toContain("1 barber belum memiliki nama (tersembunyi)");
    });
  });

  describe("Interactive Recovery Flow (Client-Side & Fetch)", () => {
    it("opens inline edit form when clicking Lengkapi Nama", async () => {
      const unnamedBarber = makeBarber({
        id: "unnamed-1",
        displayName: null,
        missingDisplayName: true,
      });

      await renderComponent(
        <AdminBarbersRecovery initialBarbers={[unnamedBarber]} />,
      );

      const editButton = container.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      expect(editButton).not.toBeNull();
      expect(editButton.textContent).toContain("Lengkapi Nama");

      await act(async () => {
        editButton.click();
      });

      const editForm = container.querySelector(
        '[data-testid="edit-form-unnamed-1"]',
      );
      expect(editForm).not.toBeNull();

      const input = container.querySelector(
        'input[id="displayName-unnamed-1"]',
      ) as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.placeholder).toContain("Contoh: Budi Santoso");
    });

    it("prevents PATCH submission and displays error when input is blank", async () => {
      const unnamedBarber = makeBarber({
        id: "unnamed-1",
        displayName: null,
        missingDisplayName: true,
      });

      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      await renderComponent(
        <AdminBarbersRecovery initialBarbers={[unnamedBarber]} />,
      );

      // Open form
      const openButton = container.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      await act(async () => {
        openButton.click();
      });

      // Submit with empty input
      const saveButton = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Simpan Nama"),
      )!;

      await act(async () => {
        saveButton.click();
      });

      // Fetch was NOT called
      expect(mockFetch).not.toHaveBeenCalled();

      // Validation error displayed
      const errorMsg = container.querySelector('p[role="alert"]');
      expect(errorMsg).not.toBeNull();
      expect(errorMsg?.textContent).toContain("wajib diisi");
    });

    it("successfully submits PATCH, updates barber display state, and removes missing-name warning", async () => {
      const unnamedBarber = makeBarber({
        id: "unnamed-1",
        displayName: null,
        missingDisplayName: true,
      });

      const updatedBarber: AdminBarberDto = {
        ...unnamedBarber,
        displayName: "Rian Hidayat",
        missingDisplayName: false,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: updatedBarber }),
      });
      globalThis.fetch = mockFetch;

      await renderComponent(
        <AdminBarbersRecovery initialBarbers={[unnamedBarber]} />,
      );

      // Open form
      const openButton = container.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      await act(async () => {
        openButton.click();
      });

      // Type new name
      const input = container.querySelector(
        'input[id="displayName-unnamed-1"]',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(input, "Rian Hidayat");
      });

      // Click save
      const saveButton = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Simpan Nama"),
      )!;

      await act(async () => {
        saveButton.click();
      });

      // Verify PATCH was sent to correct endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/admin/barbers/unnamed-1/display-name",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ displayName: "Rian Hidayat" }),
        },
      );

      // Verify updated state: name updated, missing-name warning removed
      expect(container.textContent).toContain("Rian Hidayat");
      expect(container.textContent).toContain("Nama Lengkap");
      expect(container.textContent).not.toContain(
        "PERINGATAN: Barber ini belum memiliki nama lengkap",
      );
      expect(container.textContent).toContain(
        "Nama untuk barber Rian Hidayat berhasil diperbarui!",
      );
    });

    it("handles PATCH failure without displaying false success", async () => {
      const unnamedBarber = makeBarber({
        id: "unnamed-1",
        displayName: null,
        missingDisplayName: true,
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: "VALIDATION_ERROR",
            message: "Nama tidak valid",
          },
        }),
      });
      globalThis.fetch = mockFetch;

      await renderComponent(
        <AdminBarbersRecovery initialBarbers={[unnamedBarber]} />,
      );

      // Open form
      const openButton = container.querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      await act(async () => {
        openButton.click();
      });

      // Type name
      const input = container.querySelector(
        'input[id="displayName-unnamed-1"]',
      ) as HTMLInputElement;
      await act(async () => {
        setInputValue(input, "Test");
      });

      // Click save
      const saveButton = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Simpan Nama"),
      )!;

      await act(async () => {
        saveButton.click();
      });

      // Error banner displayed
      const errorAlert = container.querySelector(
        '[data-testid="save-error-alert"]',
      );
      expect(errorAlert).not.toBeNull();
      expect(errorAlert?.textContent).toContain("Nama tidak valid");

      // No false success message
      expect(container.textContent).not.toContain("berhasil diperbarui");
      // Still unnamed
      expect(container.textContent).toContain("Perlu Pemulihan Nama");
    });
  });
});
