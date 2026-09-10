import { describe, expect, it, vi } from "vitest";
import {
  downloadIcsFile,
  escapeIcsText,
  formatIcsDate,
  generateIcsContent,
} from "../calendar";

describe("calendar utility", () => {
  describe("escapeIcsText", () => {
    it("escapes backslashes, semicolons, commas, and newlines", () => {
      const input =
        "Hello; World, testing \\ backslash and\nnewline with\r\nanother";
      const escaped = escapeIcsText(input);
      expect(escaped).toBe(
        "Hello\\; World\\, testing \\\\ backslash and\\nnewline with\\nanother",
      );
    });

    it("returns plain text unchanged when no special characters exist", () => {
      expect(escapeIcsText("Classic Cut")).toBe("Classic Cut");
    });
  });

  describe("formatIcsDate", () => {
    it("formats ISO date string into UTC YYYYMMDDTHHmmssZ", () => {
      const result = formatIcsDate("2026-09-15T14:30:00.000Z");
      expect(result).toBe("20260915T143000Z");
    });

    it("formats Date object into UTC YYYYMMDDTHHmmssZ", () => {
      const date = new Date("2026-10-01T09:00:00.000Z");
      expect(formatIcsDate(date)).toBe("20261001T090000Z");
    });

    it("throws an error for invalid date inputs", () => {
      expect(() => formatIcsDate("invalid-date-string")).toThrow(
        "Invalid date provided to formatIcsDate",
      );
    });
  });

  describe("generateIcsContent", () => {
    it("generates valid RFC 5545 calendar structure for appointment", () => {
      const ics = generateIcsContent({
        bookingReference: "BK-20260915-001",
        serviceName: "Gentlemen Cut & Style",
        barberName: "Budi Santoso",
        startsAt: "2026-09-15T10:00:00.000Z",
        endsAt: "2026-09-15T10:45:00.000Z",
        location: "BarberKece Studio, Jakarta Selatan",
        notes: "Mohon fade tipis di samping; jangan terlalu pendek.",
      });

      // Structure check
      expect(ics).toContain("BEGIN:VCALENDAR\r\n");
      expect(ics).toContain("VERSION:2.0\r\n");
      expect(ics).toContain("PRODID:-//BarberKece//Reservation//ID\r\n");
      expect(ics).toContain("CALSCALE:GREGORIAN\r\n");
      expect(ics).toContain("METHOD:PUBLISH\r\n");
      expect(ics).toContain("BEGIN:VEVENT\r\n");
      expect(ics).toContain(
        "UID:appointment-BK-20260915-001@barberkece.com\r\n",
      );
      expect(ics).toContain("DTSTART:20260915T100000Z\r\n");
      expect(ics).toContain("DTEND:20260915T104500Z\r\n");
      expect(ics).toContain(
        "SUMMARY:BarberKece - Gentlemen Cut & Style bersama Budi Santoso\r\n",
      );
      expect(ics).toContain(
        "LOCATION:BarberKece Studio\\, Jakarta Selatan\r\n",
      );
      expect(ics).toContain(
        "DESCRIPTION:Kode Reservasi: BK-20260915-001\\nLayanan: Gentlemen Cut & Style\\nBarber: Budi Santoso\\nCatatan: Mohon fade tipis di samping\\; jangan terlalu pendek.\r\n",
      );
      expect(ics).toContain("STATUS:CONFIRMED\r\n");
      expect(ics).toContain("END:VEVENT\r\n");
      expect(ics).toContain("END:VCALENDAR\r\n");
    });

    it("handles appointment without specific barber or notes (ANY_AVAILABLE)", () => {
      const ics = generateIcsContent({
        bookingReference: "BK-20260915-002",
        serviceName: "Express Beard Trim",
        startsAt: new Date("2026-09-15T11:00:00.000Z"),
        endsAt: new Date("2026-09-15T11:30:00.000Z"),
      });

      expect(ics).toContain("SUMMARY:BarberKece - Express Beard Trim\r\n");
      expect(ics).toContain("LOCATION:BarberKece\\, Jakarta\r\n");
      expect(ics).toContain(
        "DESCRIPTION:Kode Reservasi: BK-20260915-002\\nLayanan: Express Beard Trim\r\n",
      );
      expect(ics).not.toContain("Barber:");
      expect(ics).not.toContain("Catatan:");
    });
  });

  describe("downloadIcsFile", () => {
    it("returns false if window is not defined (SSR)", () => {
      const result = downloadIcsFile("booking.ics", "test-ics-content");
      expect(result).toBe(false);
    });

    it("creates an anchor element and clicks it in a DOM environment", () => {
      const clickMock = vi.fn();
      const setAttributeMock = vi.fn();
      const appendChildMock = vi.fn();
      const removeChildMock = vi.fn();
      const createObjectURLMock = vi
        .fn()
        .mockReturnValue("blob:http://localhost/test");
      const revokeObjectURLMock = vi.fn();

      const mockAnchor = {
        href: "",
        click: clickMock,
        setAttribute: setAttributeMock,
      };

      const mockDocument = {
        body: {
          appendChild: appendChildMock,
          removeChild: removeChildMock,
        },
        createElement: vi.fn().mockReturnValue(mockAnchor),
      };

      (globalThis as unknown as { window: unknown }).window = {
        document: mockDocument,
        URL: {
          createObjectURL: createObjectURLMock,
          revokeObjectURL: revokeObjectURLMock,
        },
      };

      try {
        const result = downloadIcsFile("reservasi-bk", "BEGIN:VCALENDAR...");

        expect(result).toBe(true);
        expect(createObjectURLMock).toHaveBeenCalled();
        expect(mockDocument.createElement).toHaveBeenCalledWith("a");
        expect(setAttributeMock).toHaveBeenCalledWith(
          "download",
          "reservasi-bk.ics",
        );
        expect(appendChildMock).toHaveBeenCalledWith(mockAnchor);
        expect(clickMock).toHaveBeenCalled();
        expect(removeChildMock).toHaveBeenCalledWith(mockAnchor);
        expect(revokeObjectURLMock).toHaveBeenCalledWith(
          "blob:http://localhost/test",
        );
      } finally {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
    });
  });
});
