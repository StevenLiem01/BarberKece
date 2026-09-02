import * as crypto from "node:crypto";

const REQUEST_ID_PREFIX = "req_";
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Generates a unique, cryptographically random request ID with the 'req_' prefix.
 */
export function generateRequestId(): string {
  return `${REQUEST_ID_PREFIX}${crypto.randomUUID()}`;
}

/**
 * Validates and sanitizes an incoming request ID header value.
 * If valid and within safe limits, returns the sanitized ID.
 * Otherwise, generates a fresh request ID to protect against header injection.
 */
export function sanitizeRequestId(
  headerValue?: string | string[] | null,
): string {
  if (!headerValue) {
    return generateRequestId();
  }

  const rawValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!rawValue || typeof rawValue !== "string") {
    return generateRequestId();
  }

  const trimmed = rawValue.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    return generateRequestId();
  }

  if (SAFE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  return generateRequestId();
}
