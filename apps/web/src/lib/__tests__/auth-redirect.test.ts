import { describe, it, expect } from "vitest";
import { resolveAuthRedirect, isRoleSpace, ROLE_HOMES } from "../auth-redirect";

describe("resolveAuthRedirect helper", () => {
  describe("SAFE destinations", () => {
    it("allows CUSTOMER accessing /account", () => {
      expect(resolveAuthRedirect("CUSTOMER", "/account")).toBe("/account");
    });

    it("allows CUSTOMER accessing /account/profile", () => {
      expect(resolveAuthRedirect("CUSTOMER", "/account/profile")).toBe(
        "/account/profile",
      );
    });

    it("allows BARBER accessing /barber", () => {
      expect(resolveAuthRedirect("BARBER", "/barber")).toBe("/barber");
    });

    it("allows ADMIN accessing /admin/users", () => {
      expect(resolveAuthRedirect("ADMIN", "/admin/users")).toBe("/admin/users");
    });

    it("allows valid public local route for any role", () => {
      expect(resolveAuthRedirect("CUSTOMER", "/services")).toBe("/services");
      expect(resolveAuthRedirect("BARBER", "/catalog")).toBe("/catalog");
      expect(resolveAuthRedirect("ADMIN", "/")).toBe("/");
      expect(resolveAuthRedirect("CUSTOMER", "/about?ref=nav#top")).toBe(
        "/about?ref=nav#top",
      );
    });
  });

  describe("REJECT / FALLBACK to canonical role home", () => {
    it("rejects CUSTOMER accessing /admin and falls back to /account", () => {
      expect(resolveAuthRedirect("CUSTOMER", "/admin")).toBe(
        ROLE_HOMES.CUSTOMER,
      );
      expect(resolveAuthRedirect("CUSTOMER", "/admin/settings")).toBe(
        ROLE_HOMES.CUSTOMER,
      );
    });

    it("rejects CUSTOMER accessing /barber and falls back to /account", () => {
      expect(resolveAuthRedirect("CUSTOMER", "/barber")).toBe(
        ROLE_HOMES.CUSTOMER,
      );
      expect(resolveAuthRedirect("CUSTOMER", "/barber/appointments")).toBe(
        ROLE_HOMES.CUSTOMER,
      );
    });

    it("rejects BARBER accessing /account and falls back to /barber", () => {
      expect(resolveAuthRedirect("BARBER", "/account")).toBe(ROLE_HOMES.BARBER);
      expect(resolveAuthRedirect("BARBER", "/account/orders")).toBe(
        ROLE_HOMES.BARBER,
      );
    });

    it("rejects ADMIN accessing /barber and falls back to /admin", () => {
      expect(resolveAuthRedirect("ADMIN", "/barber")).toBe(ROLE_HOMES.ADMIN);
    });

    it("rejects absolute URLs (e.g. https://evil.example)", () => {
      expect(resolveAuthRedirect("CUSTOMER", "https://evil.example")).toBe(
        ROLE_HOMES.CUSTOMER,
      );
      expect(resolveAuthRedirect("ADMIN", "http://attacker.com/admin")).toBe(
        ROLE_HOMES.ADMIN,
      );
    });

    it("rejects protocol-relative URLs (e.g. //evil.example)", () => {
      expect(resolveAuthRedirect("CUSTOMER", "//evil.example")).toBe(
        ROLE_HOMES.CUSTOMER,
      );
      expect(resolveAuthRedirect("BARBER", "//barber.evil.com")).toBe(
        ROLE_HOMES.BARBER,
      );
    });

    it("rejects backslash-based network-path variants (e.g. /\\evil.com)", () => {
      expect(resolveAuthRedirect("CUSTOMER", "/\\evil.com")).toBe(
        ROLE_HOMES.CUSTOMER,
      );
      expect(resolveAuthRedirect("BARBER", "\\evil.com")).toBe(
        ROLE_HOMES.BARBER,
      );
      expect(resolveAuthRedirect("ADMIN", "/account\\..\\admin")).toBe(
        ROLE_HOMES.ADMIN,
      );
    });

    it("normalizes path traversals and rejects cross-role escalation (/account/../admin)", () => {
      // Normalizes to /admin which is prohibited for CUSTOMER
      expect(resolveAuthRedirect("CUSTOMER", "/account/../admin")).toBe(
        ROLE_HOMES.CUSTOMER,
      );
      // Prohibited for BARBER as well
      expect(resolveAuthRedirect("BARBER", "/barber/../admin")).toBe(
        ROLE_HOMES.BARBER,
      );
    });

    it("rejects malformed URLs or invalid encoding", () => {
      expect(resolveAuthRedirect("CUSTOMER", "/%")).toBe(ROLE_HOMES.CUSTOMER);
      expect(resolveAuthRedirect("CUSTOMER", "not-a-path")).toBe(
        ROLE_HOMES.CUSTOMER,
      );
      expect(resolveAuthRedirect("CUSTOMER", "/%5cevil.com")).toBe(
        ROLE_HOMES.CUSTOMER,
      );
      expect(resolveAuthRedirect("CUSTOMER", "/null\0byte")).toBe(
        ROLE_HOMES.CUSTOMER,
      );
    });

    it("falls back to role home when nextUrl is null, undefined, or empty", () => {
      expect(resolveAuthRedirect("CUSTOMER", null)).toBe(ROLE_HOMES.CUSTOMER);
      expect(resolveAuthRedirect("CUSTOMER", undefined)).toBe(
        ROLE_HOMES.CUSTOMER,
      );
      expect(resolveAuthRedirect("BARBER", "")).toBe(ROLE_HOMES.BARBER);
      expect(resolveAuthRedirect("ADMIN", "")).toBe(ROLE_HOMES.ADMIN);
    });
  });

  describe("Segment-boundary validation", () => {
    it("ensures /accounting is not treated as /account", () => {
      // isRoleSpace boundary checks
      expect(isRoleSpace("/account", "/account")).toBe(true);
      expect(isRoleSpace("/account/profile", "/account")).toBe(true);
      expect(isRoleSpace("/accounting", "/account")).toBe(false);
      expect(isRoleSpace("/account-settings", "/account")).toBe(false);

      // BARBER requesting /accounting is not blocked as customer-only /account space
      expect(resolveAuthRedirect("BARBER", "/accounting")).toBe("/accounting");
      // CUSTOMER requesting /accounting is treated as public route, not customer space
      expect(resolveAuthRedirect("CUSTOMER", "/accounting")).toBe(
        "/accounting",
      );
    });

    it("ensures /admin-portal is not treated as /admin", () => {
      expect(isRoleSpace("/admin", "/admin")).toBe(true);
      expect(isRoleSpace("/admin/users", "/admin")).toBe(true);
      expect(isRoleSpace("/admin-portal", "/admin")).toBe(false);

      expect(resolveAuthRedirect("CUSTOMER", "/admin-portal")).toBe(
        "/admin-portal",
      );
    });

    it("ensures /barber-shop is not treated as /barber", () => {
      expect(isRoleSpace("/barber", "/barber")).toBe(true);
      expect(isRoleSpace("/barber/schedule", "/barber")).toBe(true);
      expect(isRoleSpace("/barber-shop", "/barber")).toBe(false);

      expect(resolveAuthRedirect("CUSTOMER", "/barber-shop")).toBe(
        "/barber-shop",
      );
    });
  });
});
