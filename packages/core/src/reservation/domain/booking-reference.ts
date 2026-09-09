import { randomBytes } from "node:crypto";
import { getJakartaCalendarDateString } from "./date-utils.js";

const CROCKFORD_BASE32_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export interface BookingReferenceGenerator {
  generate(startsAt: Date): string;
}

export class DefaultBookingReferenceGenerator implements BookingReferenceGenerator {
  generate(startsAt: Date): string {
    const dateStr = getJakartaCalendarDateString(startsAt).replace(/-/g, "");
    const bytes = randomBytes(6);
    let token = "";
    for (let i = 0; i < 6; i++) {
      const byte = bytes[i] ?? 0;
      token += CROCKFORD_BASE32_CHARS[byte % 32];
    }
    return `BK-${dateStr}-${token}`;
  }
}
