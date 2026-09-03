import { describe, it, expect, vi, beforeEach } from "vitest";
import AccountLayout from "../account/layout";
import BarberLayout from "../barber/layout";
import AdminLayout from "../admin/layout";
import React from "react";

const { mockRequireRole } = vi.hoisted(() => ({
  mockRequireRole: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

describe("Protected Layouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dummyChild = React.createElement("div", null, "Protected Content");

  describe("AccountLayout (/account)", () => {
    it("protects with CUSTOMER role and renders children on success", async () => {
      mockRequireRole.mockResolvedValue({ id: "cust-1", role: "CUSTOMER" });

      const result = await AccountLayout({ children: dummyChild });

      expect(mockRequireRole).toHaveBeenCalledWith("CUSTOMER");
      expect(result).toBeDefined();
    });

    it("fails when requireRole rejects unauthenticated user", async () => {
      mockRequireRole.mockRejectedValue(new Error("NEXT_REDIRECT: /login"));

      await expect(AccountLayout({ children: dummyChild })).rejects.toThrow(
        "NEXT_REDIRECT: /login",
      );
      expect(mockRequireRole).toHaveBeenCalledWith("CUSTOMER");
    });

    it("fails when requireRole rejects unauthorized role (e.g. BARBER or ADMIN)", async () => {
      mockRequireRole.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

      await expect(AccountLayout({ children: dummyChild })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(mockRequireRole).toHaveBeenCalledWith("CUSTOMER");
    });
  });

  describe("BarberLayout (/barber)", () => {
    it("protects with BARBER role and renders children on success", async () => {
      mockRequireRole.mockResolvedValue({ id: "barb-1", role: "BARBER" });

      const result = await BarberLayout({ children: dummyChild });

      expect(mockRequireRole).toHaveBeenCalledWith("BARBER");
      expect(result).toBeDefined();
    });

    it("fails when requireRole rejects unauthenticated user", async () => {
      mockRequireRole.mockRejectedValue(new Error("NEXT_REDIRECT: /login"));

      await expect(BarberLayout({ children: dummyChild })).rejects.toThrow(
        "NEXT_REDIRECT: /login",
      );
      expect(mockRequireRole).toHaveBeenCalledWith("BARBER");
    });

    it("fails when requireRole rejects unauthorized role (e.g. CUSTOMER or ADMIN)", async () => {
      mockRequireRole.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

      await expect(BarberLayout({ children: dummyChild })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(mockRequireRole).toHaveBeenCalledWith("BARBER");
    });
  });

  describe("AdminLayout (/admin)", () => {
    it("protects with ADMIN role and renders children on success", async () => {
      mockRequireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });

      const result = await AdminLayout({ children: dummyChild });

      expect(mockRequireRole).toHaveBeenCalledWith("ADMIN");
      expect(result).toBeDefined();
    });

    it("fails when requireRole rejects unauthenticated user", async () => {
      mockRequireRole.mockRejectedValue(new Error("NEXT_REDIRECT: /login"));

      await expect(AdminLayout({ children: dummyChild })).rejects.toThrow(
        "NEXT_REDIRECT: /login",
      );
      expect(mockRequireRole).toHaveBeenCalledWith("ADMIN");
    });

    it("fails when requireRole rejects unauthorized role (e.g. CUSTOMER or BARBER)", async () => {
      mockRequireRole.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

      await expect(AdminLayout({ children: dummyChild })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(mockRequireRole).toHaveBeenCalledWith("ADMIN");
    });
  });
});
