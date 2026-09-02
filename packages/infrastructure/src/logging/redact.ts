/**
 * Generates exact and wildcard paths for a given field name across nested depths (1 to 5).
 * e.g. for "password": ["password", "*.password", "*.*.password", "*.*.*.password", "*.*.*.*.password"]
 */
function createNestedRedactPaths(field: string): string[] {
  return [
    field,
    `*.${field}`,
    `*.*.${field}`,
    `*.*.*.${field}`,
    `*.*.*.*.${field}`,
  ];
}

const SENSITIVE_FIELDS: readonly string[] = [
  "password",
  "passwordHash",
  "token",
  "sessionToken",
  "resetToken",
  "refreshToken",
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "apiKey",
  "creditCard",
  "cardNumber",
  "cvv",
  "emailBody",
  "signedUrl",
  "proofUrl",
  "cameraFrames",
  "landmarks",
  "previewBytes",
];

/**
 * Central list of property paths and field names to redact from all structured logs.
 * Covers root, shallow, and deep nested paths up to 5 levels of nesting.
 */
export const DEFAULT_REDACT_PATHS: readonly string[] = Array.from(
  new Set([
    ...SENSITIVE_FIELDS.flatMap(createNestedRedactPaths),
    "headers.authorization",
    "*.headers.authorization",
    "*.*.headers.authorization",
    "headers.cookie",
    "*.headers.cookie",
    "*.*.headers.cookie",
    "headers['set-cookie']",
    "*.headers['set-cookie']",
    "*.*.headers['set-cookie']",
  ]),
);

export const REDACTED_VALUE = "[REDACTED]";
