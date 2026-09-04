import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { validateSameOrigin } from "../same-origin";

describe("validateSameOrigin helper", () => {
  const createRequest = (options?: {
    origin?: string;
    referer?: string;
    host?: string;
    url?: string;
  }) => {
    const headers = new Headers();
    if (options?.origin !== undefined) {
      headers.set("origin", options.origin);
    }
    if (options?.referer !== undefined) {
      headers.set("referer", options.referer);
    }
    if (options?.host !== undefined) {
      headers.set("host", options.host);
    }

    return new NextRequest(options?.url ?? "http://localhost:3000/api/test", {
      method: "POST",
      headers,
    });
  };

  describe("when Origin header is present", () => {
    it("allows request when Origin host matches Host header", () => {
      const req = createRequest({
        origin: "http://localhost:3000",
        host: "localhost:3000",
      });

      const result = validateSameOrigin(req);

      expect(result).toEqual({ isValid: true });
    });

    it("allows request when Origin host matches nextUrl host if Host header is missing", () => {
      const req = createRequest({
        origin: "http://localhost:3000",
        url: "http://localhost:3000/api/test",
      });

      const result = validateSameOrigin(req);

      expect(result).toEqual({ isValid: true });
    });

    it("rejects request when Origin host does not match Host header", () => {
      const req = createRequest({
        origin: "https://evil.com",
        host: "localhost:3000",
      });

      const result = validateSameOrigin(req);

      expect(result).toEqual({
        isValid: false,
        message: "Cross-origin request forbidden",
        reason: "mismatched_origin",
      });
    });

    it("rejects request when Origin has different port", () => {
      const req = createRequest({
        origin: "http://localhost:4000",
        host: "localhost:3000",
      });

      const result = validateSameOrigin(req);

      expect(result).toEqual({
        isValid: false,
        message: "Cross-origin request forbidden",
        reason: "mismatched_origin",
      });
    });

    it("rejects request when Origin is malformed", () => {
      const req = createRequest({
        origin: "not-a-valid-url",
        host: "localhost:3000",
      });

      const result = validateSameOrigin(req);

      expect(result).toEqual({
        isValid: false,
        message: "Invalid origin header",
        reason: "invalid_origin",
      });
    });

    it("takes precedence over Referer header when Origin matches even if Referer is different", () => {
      const req = createRequest({
        origin: "http://localhost:3000",
        referer: "https://evil.com/some/path",
        host: "localhost:3000",
      });

      const result = validateSameOrigin(req);

      expect(result).toEqual({ isValid: true });
    });

    it("takes precedence over Referer header when Origin mismatches even if Referer matches", () => {
      const req = createRequest({
        origin: "https://evil.com",
        referer: "http://localhost:3000/some/path",
        host: "localhost:3000",
      });

      const result = validateSameOrigin(req);

      expect(result).toEqual({
        isValid: false,
        message: "Cross-origin request forbidden",
        reason: "mismatched_origin",
      });
    });
  });

  describe("when Origin header is absent", () => {
    it("allows request when Referer host matches Host header", () => {
      const req = createRequest({
        referer: "http://localhost:3000/sign-in",
        host: "localhost:3000",
      });

      const result = validateSameOrigin(req);

      expect(result).toEqual({ isValid: true });
    });

    it("rejects request when Referer host does not match Host header", () => {
      const req = createRequest({
        referer: "https://evil.com/phish",
        host: "localhost:3000",
      });

      const result = validateSameOrigin(req);

      expect(result).toEqual({
        isValid: false,
        message: "Cross-origin request forbidden",
        reason: "mismatched_referer",
      });
    });

    it("rejects request when Referer is malformed", () => {
      const req = createRequest({
        referer: "invalid-url-string",
        host: "localhost:3000",
      });

      const result = validateSameOrigin(req);

      expect(result).toEqual({
        isValid: false,
        message: "Invalid referer header",
        reason: "invalid_referer",
      });
    });

    it("rejects request when both Origin and Referer are absent", () => {
      const req = createRequest({
        host: "localhost:3000",
      });

      const result = validateSameOrigin(req);

      expect(result).toEqual({
        isValid: false,
        message: "Cross-origin request forbidden",
        reason: "missing_origin",
      });
    });
  });
});
