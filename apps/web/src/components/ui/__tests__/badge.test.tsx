import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Badge, getAppointmentStatusMeta } from "../badge";
import { CalendarIcon, ClockIcon } from "../icons";

describe("Badge and UI Primitives", () => {
  describe("getAppointmentStatusMeta", () => {
    it("maps CONFIRMED correctly to success variant and Indonesian label", () => {
      const meta = getAppointmentStatusMeta("CONFIRMED");
      expect(meta.label).toBe("Terkonfirmasi");
      expect(meta.variant).toBe("success");
    });

    it("maps CHECKED_IN correctly to info variant", () => {
      const meta = getAppointmentStatusMeta("CHECKED_IN");
      expect(meta.label).toBe("Check-In");
      expect(meta.variant).toBe("info");
    });

    it("maps IN_SERVICE correctly to lime variant", () => {
      const meta = getAppointmentStatusMeta("IN_SERVICE");
      expect(meta.label).toBe("Sedang Dilayani");
      expect(meta.variant).toBe("lime");
    });

    it("maps COMPLETED correctly to neutral variant", () => {
      const meta = getAppointmentStatusMeta("COMPLETED");
      expect(meta.label).toBe("Selesai");
      expect(meta.variant).toBe("neutral");
    });

    it("maps CANCELLED_BY_CUSTOMER and CANCELLED_BY_BARBERSHOP correctly to error variant", () => {
      const customerMeta = getAppointmentStatusMeta("CANCELLED_BY_CUSTOMER");
      expect(customerMeta.label).toBe("Dibatalkan (Pelanggan)");
      expect(customerMeta.variant).toBe("error");

      const shopMeta = getAppointmentStatusMeta("CANCELLED_BY_BARBERSHOP");
      expect(shopMeta.label).toBe("Dibatalkan (Barbershop)");
      expect(shopMeta.variant).toBe("error");
    });

    it("maps NO_SHOW correctly to warning variant", () => {
      const meta = getAppointmentStatusMeta("NO_SHOW");
      expect(meta.label).toBe("Tidak Hadir");
      expect(meta.variant).toBe("warning");
    });

    it("falls back to default variant and raw string for unknown status", () => {
      const meta = getAppointmentStatusMeta("UNKNOWN_STATUS");
      expect(meta.label).toBe("UNKNOWN_STATUS");
      expect(meta.variant).toBe("default");
    });
  });

  describe("Badge rendering", () => {
    it("renders with role='status' and canonical success tokens for CONFIRMED status", () => {
      const html = renderToString(<Badge status="CONFIRMED" />);
      expect(html).toContain('role="status"');
      expect(html).toContain("Terkonfirmasi");
      expect(html).toContain("text-[#2F7D4A]");
    });

    it("allows custom children override while preserving resolved variant style", () => {
      const html = renderToString(
        <Badge status="CONFIRMED">Menunggu Kedatangan</Badge>,
      );
      expect(html).toContain("Menunggu Kedatangan");
      expect(html).not.toContain("Terkonfirmasi");
      expect(html).toContain("text-[#2F7D4A]");
    });

    it("renders explicitly specified variant when provided", () => {
      const html = renderToString(<Badge variant="lime">Baru</Badge>);
      expect(html).toContain("Baru");
      expect(html).toContain("bg-[#C9F23B]/25");
      expect(html).toContain("border-[#C9F23B]/80");
    });
  });

  describe("Icons rendering", () => {
    it("renders accessible SVG with aria-hidden='true' and specified size", () => {
      const calendarHtml = renderToString(
        <CalendarIcon size={24} className="text-stone" />,
      );
      expect(calendarHtml).toContain('width="24"');
      expect(calendarHtml).toContain('height="24"');
      expect(calendarHtml).toContain('aria-hidden="true"');
      expect(calendarHtml).toContain('class="text-stone"');

      const clockHtml = renderToString(<ClockIcon />);
      expect(clockHtml).toContain('width="20"');
      expect(clockHtml).toContain('aria-hidden="true"');
    });
  });
});
