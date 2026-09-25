/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import {
  AdminBarberInviteForm,
  validateBarberInviteInput,
} from "../admin-barber-invite-form";

// @ts-expect-error React act environment flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

describe("AdminBarberInviteForm", () => {
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

  describe("Validation Logic (validateBarberInviteInput)", () => {
    it("rejects empty or whitespace-only display name", () => {
      const res1 = validateBarberInviteInput("", "barber@example.com");
      expect(res1.isValid).toBe(false);
      expect(res1.errors.displayName).toContain("wajib diisi");

      const res2 = validateBarberInviteInput("   ", "barber@example.com");
      expect(res2.isValid).toBe(false);
      expect(res2.errors.displayName).toContain("wajib diisi");
    });

    it("rejects display name exceeding 100 characters", () => {
      const longName = "B".repeat(101);
      const res = validateBarberInviteInput(longName, "barber@example.com");
      expect(res.isValid).toBe(false);
      expect(res.errors.displayName).toContain("100 karakter");
    });

    it("rejects empty or invalid email format", () => {
      const resEmpty = validateBarberInviteInput("Budi Santoso", "");
      expect(resEmpty.isValid).toBe(false);
      expect(resEmpty.errors.email).toContain("wajib diisi");

      const resInvalid = validateBarberInviteInput(
        "Budi Santoso",
        "not-an-email",
      );
      expect(resInvalid.isValid).toBe(false);
      expect(resInvalid.errors.email).toContain("Format email tidak valid");
    });

    it("accepts valid trimmed display name and normalized email", () => {
      const res = validateBarberInviteInput(
        "  Budi Santoso  ",
        "  BUDI@EXAMPLE.COM  ",
      );
      expect(res.isValid).toBe(true);
      expect(res.errors).toEqual({});
      expect(res.cleanData.displayName).toBe("Budi Santoso");
      expect(res.cleanData.email).toBe("budi@example.com");
    });
  });

  describe("Form Component Rendering & Submission", () => {
    it("renders form fields and submit button properly", async () => {
      await renderComponent(<AdminBarberInviteForm />);

      expect(container.textContent).toContain("Undang Barber Baru");
      expect(container.textContent).toContain("Nama Lengkap Barber");
      expect(container.textContent).toContain("Email Barber");

      const nameInput = container.querySelector(
        'input[id="invite-displayName"]',
      ) as HTMLInputElement;
      const emailInput = container.querySelector(
        'input[id="invite-email"]',
      ) as HTMLInputElement;
      const submitBtn = container.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement;

      expect(nameInput).not.toBeNull();
      expect(emailInput).not.toBeNull();
      expect(submitBtn).not.toBeNull();
      expect(submitBtn.textContent).toContain("Kirim Undangan Barber");
    });

    it("prevents submission and displays field errors when fields are empty", async () => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch;

      await renderComponent(<AdminBarberInviteForm />);

      const form = container.querySelector("form")!;
      await act(async () => {
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });

      expect(mockFetch).not.toHaveBeenCalled();

      const alerts = container.querySelectorAll('p[role="alert"]');
      expect(alerts.length).toBe(2);
      expect(container.textContent).toContain(
        "Nama lengkap barber wajib diisi",
      );
      expect(container.textContent).toContain("Email barber wajib diisi");
    });

    it("submits valid form data with role: BARBER and credentials: same-origin", async () => {
      const mockResponse = {
        data: {
          id: "inv-uuid-1",
          email: "barber@barberkece.id",
          displayName: "Ahmad Fauzi",
          role: "BARBER",
          expiresAt: "2026-09-27T10:00:00.000Z",
          createdAt: "2026-09-25T10:00:00.000Z",
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });
      globalThis.fetch = mockFetch;

      const onSuccess = vi.fn();
      await renderComponent(<AdminBarberInviteForm onSuccess={onSuccess} />);

      const nameInput = container.querySelector(
        'input[id="invite-displayName"]',
      ) as HTMLInputElement;
      const emailInput = container.querySelector(
        'input[id="invite-email"]',
      ) as HTMLInputElement;

      await act(async () => {
        setInputValue(nameInput, "Ahmad Fauzi");
        setInputValue(emailInput, "barber@barberkece.id");
      });

      const form = container.querySelector("form")!;
      await act(async () => {
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          displayName: "Ahmad Fauzi",
          email: "barber@barberkece.id",
          role: "BARBER",
        }),
      });

      expect(onSuccess).toHaveBeenCalledWith(mockResponse.data);

      // Verify success card is shown
      const successCard = container.querySelector(
        '[data-testid="invite-success-card"]',
      );
      expect(successCard).not.toBeNull();
      expect(container.textContent).toContain(
        "Undangan Barber Berhasil Dibuat & Dikirim!",
      );
      expect(container.textContent).toContain("barber@barberkece.id");
      expect(container.textContent).toContain("Ahmad Fauzi");
      expect(container.textContent).toContain(
        "Akun barber belum aktif dan belum muncul di daftar barber aktif",
      );
      expect(container.textContent).toContain(
        "Staf barber wajib membuka email tersebut dan menyetujui undangan",
      );

      // Form is hidden and "Undang Barber Lain" button is available
      expect(container.querySelector("form")).toBeNull();
      const anotherBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Undang Barber Lain"),
      );
      expect(anotherBtn).not.toBeUndefined();

      // Click "Undang Barber Lain" resets to fresh form
      await act(async () => {
        anotherBtn!.click();
      });
      expect(container.querySelector("form")).not.toBeNull();
    });

    it("prevents duplicate submissions while request is in flight", async () => {
      let resolveFetch!: (res: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      const mockFetch = vi.fn().mockImplementation(() => fetchPromise);
      globalThis.fetch = mockFetch;

      await renderComponent(<AdminBarberInviteForm />);

      const nameInput = container.querySelector(
        'input[id="invite-displayName"]',
      ) as HTMLInputElement;
      const emailInput = container.querySelector(
        'input[id="invite-email"]',
      ) as HTMLInputElement;

      await act(async () => {
        setInputValue(nameInput, "Ahmad Fauzi");
        setInputValue(emailInput, "barber@barberkece.id");
      });

      const form = container.querySelector("form")!;
      let submitPromise: Promise<void>;
      act(() => {
        submitPromise = Promise.resolve(
          form.dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
          ),
        ).then(() => {});
      });

      // Submit button should be disabled and show loading state
      const submitBtn = container.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(true);
      expect(submitBtn.textContent).toContain("Mengirim Undangan...");

      // Attempt second submission while pending
      await act(async () => {
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });

      // Fetch should still only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Complete fetch
      await act(async () => {
        resolveFetch({
          ok: true,
          status: 201,
          json: async () => ({
            data: {
              id: "inv-1",
              email: "barber@barberkece.id",
              displayName: "Ahmad Fauzi",
              role: "BARBER",
              expiresAt: "2026-09-27T10:00:00.000Z",
              createdAt: "2026-09-25T10:00:00.000Z",
            },
          }),
        });
        await submitPromise;
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("handles 409 conflict when user already exists", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: "USER_ALREADY_EXISTS",
            message: "Pengguna dengan email ini sudah terdaftar",
          },
        }),
      });
      globalThis.fetch = mockFetch;

      await renderComponent(<AdminBarberInviteForm />);

      const nameInput = container.querySelector(
        'input[id="invite-displayName"]',
      ) as HTMLInputElement;
      const emailInput = container.querySelector(
        'input[id="invite-email"]',
      ) as HTMLInputElement;

      await act(async () => {
        setInputValue(nameInput, "Existing Barber");
        setInputValue(emailInput, "existing@barberkece.id");
      });

      const form = container.querySelector("form")!;
      await act(async () => {
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });

      const errorAlert = container.querySelector(
        '[data-testid="invite-error-alert"]',
      );
      expect(errorAlert).not.toBeNull();
      expect(errorAlert?.textContent).toContain(
        "Pengguna dengan email ini sudah terdaftar di sistem",
      );

      // No false success card
      expect(
        container.querySelector('[data-testid="invite-success-card"]'),
      ).toBeNull();
      // Inputs preserved
      expect(nameInput.value).toBe("Existing Barber");
      expect(emailInput.value).toBe("existing@barberkece.id");
    });

    it("handles server error or email delivery failure with accurate retry message", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Email dispatch failed",
          },
        }),
      });
      globalThis.fetch = mockFetch;

      await renderComponent(<AdminBarberInviteForm />);

      const nameInput = container.querySelector(
        'input[id="invite-displayName"]',
      ) as HTMLInputElement;
      const emailInput = container.querySelector(
        'input[id="invite-email"]',
      ) as HTMLInputElement;

      await act(async () => {
        setInputValue(nameInput, "Failing Barber");
        setInputValue(emailInput, "fail@barberkece.id");
      });

      const form = container.querySelector("form")!;
      await act(async () => {
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });

      const errorAlert = container.querySelector(
        '[data-testid="invite-error-alert"]',
      );
      expect(errorAlert).not.toBeNull();
      expect(errorAlert?.textContent).toContain(
        "Gagal mengirim undangan email",
      );
      expect(errorAlert?.textContent).toContain(
        "Undangan mungkin belum terkirim",
      );
      expect(errorAlert?.textContent).toContain("Silakan coba lagi");

      // No false success claim
      expect(
        container.querySelector('[data-testid="invite-success-card"]'),
      ).toBeNull();
    });

    it("handles network failure without throwing uncaught error", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network Error"));
      globalThis.fetch = mockFetch;

      await renderComponent(<AdminBarberInviteForm />);

      const nameInput = container.querySelector(
        'input[id="invite-displayName"]',
      ) as HTMLInputElement;
      const emailInput = container.querySelector(
        'input[id="invite-email"]',
      ) as HTMLInputElement;

      await act(async () => {
        setInputValue(nameInput, "Network Test");
        setInputValue(emailInput, "network@barberkece.id");
      });

      const form = container.querySelector("form")!;
      await act(async () => {
        form.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      });

      const errorAlert = container.querySelector(
        '[data-testid="invite-error-alert"]',
      );
      expect(errorAlert).not.toBeNull();
      expect(errorAlert?.textContent).toContain(
        "Terjadi kesalahan jaringan saat mengirim undangan",
      );
    });
  });
});
