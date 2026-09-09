import { describe, it, expect } from "vitest";
import {
  DefaultBookingReferenceGenerator,
  BookingReferenceGenerator,
} from "../domain/booking-reference.js";

describe("BookingReferenceGenerator", () => {
  const CROCKFORD_BASE32_REGEX = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;

  it("generates references matching BK-YYYYMMDD-XXXXXX format using Jakarta calendar date", () => {
    const generator = new DefaultBookingReferenceGenerator();
    // 2026-09-09T03:00:00.000Z is 2026-09-09 10:00:00 Jakarta (+07:00)
    const instant = new Date("2026-09-09T03:00:00.000Z");
    const ref = generator.generate(instant);

    expect(ref).toMatch(/^BK-20260909-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    const parts = ref.split("-");
    expect(parts[0]).toBe("BK");
    expect(parts[1]).toBe("20260909");
    expect(parts[2]).toMatch(CROCKFORD_BASE32_REGEX);
  });

  it("respects Asia/Jakarta calendar day boundary", () => {
    const generator = new DefaultBookingReferenceGenerator();
    // 2026-09-08T17:30:00.000Z is 2026-09-09 00:30:00 in Jakarta (+07:00)
    const instant = new Date("2026-09-08T17:30:00.000Z");
    const ref = generator.generate(instant);

    expect(ref.startsWith("BK-20260909-")).toBe(true);
  });

  it("excludes ambiguous Crockford characters (I, L, O, U)", () => {
    const generator = new DefaultBookingReferenceGenerator();
    const instant = new Date("2026-09-09T03:00:00.000Z");

    for (let i = 0; i < 50; i++) {
      const ref = generator.generate(instant);
      const token = ref.split("-")[2]!;
      expect(token).not.toMatch(/[ILOU]/);
    }
  });

  it("generates distinct references across multiple calls", () => {
    const generator = new DefaultBookingReferenceGenerator();
    const instant = new Date("2026-09-09T03:00:00.000Z");
    const refs = new Set<string>();

    for (let i = 0; i < 20; i++) {
      refs.add(generator.generate(instant));
    }

    expect(refs.size).toBe(20);
  });

  it("allows custom injectable generator implementation for deterministic testing", () => {
    class DeterministicGenerator implements BookingReferenceGenerator {
      private count = 0;
      generate(_startsAt: Date): string {
        void _startsAt;
        this.count++;
        return `BK-MOCK-${String(this.count).padStart(6, "0")}`;
      }
    }

    const custom = new DeterministicGenerator();
    expect(custom.generate(new Date())).toBe("BK-MOCK-000001");
    expect(custom.generate(new Date())).toBe("BK-MOCK-000002");
  });
});
