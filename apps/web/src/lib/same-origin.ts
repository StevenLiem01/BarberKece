import { NextRequest } from "next/server";

export interface SameOriginValidationSuccess {
  isValid: true;
}

export interface SameOriginValidationFailure {
  isValid: false;
  message:
    | "Cross-origin request forbidden"
    | "Invalid origin header"
    | "Invalid referer header";
  reason:
    | "mismatched_origin"
    | "invalid_origin"
    | "mismatched_referer"
    | "invalid_referer"
    | "missing_origin";
}

export type SameOriginValidationResult =
  SameOriginValidationSuccess | SameOriginValidationFailure;

/**
 * Validates that an incoming mutation request originates from the same origin as the host.
 *
 * Rules:
 * 1. If Origin header is present:
 *    - Must be a valid URL
 *    - Hostname (+ port) must match request Host
 *    - Takes precedence over Referer header
 * 2. If Origin header is absent and Referer header is present:
 *    - Must be a valid URL
 *    - Hostname (+ port) must match request Host
 * 3. If neither Origin nor Referer header is present:
 *    - Request is rejected (fail-closed CSRF defense)
 *
 * Does not inspect request bodies or cookies/tokens.
 */
export function validateSameOrigin(
  req: NextRequest,
): SameOriginValidationResult {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host") ?? req.nextUrl.host;

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (!host || originHost !== host) {
        return {
          isValid: false,
          message: "Cross-origin request forbidden",
          reason: "mismatched_origin",
        };
      }
      return { isValid: true };
    } catch {
      return {
        isValid: false,
        message: "Invalid origin header",
        reason: "invalid_origin",
      };
    }
  }

  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (!host || refererHost !== host) {
        return {
          isValid: false,
          message: "Cross-origin request forbidden",
          reason: "mismatched_referer",
        };
      }
      return { isValid: true };
    } catch {
      return {
        isValid: false,
        message: "Invalid referer header",
        reason: "invalid_referer",
      };
    }
  }

  return {
    isValid: false,
    message: "Cross-origin request forbidden",
    reason: "missing_origin",
  };
}
