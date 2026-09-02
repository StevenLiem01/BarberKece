import { describe, expect, it } from "vitest";
import { generateRequestId, sanitizeRequestId } from "../request-id.js";

describe("Request ID Utilities", () => {
  describe("generateRequestId", () => {
    it("generates a request ID with the req_ prefix", () => {
      const id = generateRequestId();
      expect(id).toMatch(
        /^req_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("generates unique request IDs on consecutive calls", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("sanitizeRequestId", () => {
    it("returns valid incoming request IDs", () => {
      expect(sanitizeRequestId("req_custom-123_abc")).toBe(
        "req_custom-123_abc",
      );
      expect(sanitizeRequestId("trace-uuid-456")).toBe("trace-uuid-456");
    });

    it("trims whitespace from incoming request ID", () => {
      expect(sanitizeRequestId("  valid-id-123  ")).toBe("valid-id-123");
    });

    it("generates a fresh request ID if null, undefined, or empty", () => {
      expect(sanitizeRequestId(null)).toMatch(/^req_/);
      expect(sanitizeRequestId(undefined)).toMatch(/^req_/);
      expect(sanitizeRequestId("")).toMatch(/^req_/);
      expect(sanitizeRequestId("   ")).toMatch(/^req_/);
    });

    it("generates a fresh request ID if incoming ID contains unsafe injection characters", () => {
      expect(sanitizeRequestId("<script>alert(1)</script>")).toMatch(/^req_/);
      expect(sanitizeRequestId("req_test\r\ninjected_header")).toMatch(/^req_/);
      expect(sanitizeRequestId("id with spaces")).toMatch(/^req_/);
      expect(sanitizeRequestId("id; DROP TABLE users;")).toMatch(/^req_/);
    });

    it("generates a fresh request ID if incoming ID is excessively long (>128 chars)", () => {
      const tooLongId = "a".repeat(129);
      expect(sanitizeRequestId(tooLongId)).toMatch(/^req_/);
      expect(sanitizeRequestId(tooLongId)).not.toBe(tooLongId);
    });

    it("handles array header values by using the first element", () => {
      expect(sanitizeRequestId(["header-id-1", "header-id-2"])).toBe(
        "header-id-1",
      );
    });
  });
});
