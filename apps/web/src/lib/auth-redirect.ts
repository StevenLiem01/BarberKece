export type AuthRole = "CUSTOMER" | "BARBER" | "ADMIN";

export const ROLE_HOMES: Record<AuthRole, string> = {
  CUSTOMER: "/account",
  BARBER: "/barber",
  ADMIN: "/admin",
};

/**
 * Checks if a normalized pathname matches a role's protected path boundary.
 * Enforces segment boundaries so e.g. "/accounting" does not match "/account".
 */
export function isRoleSpace(pathname: string, rolePrefix: string): boolean {
  return pathname === rolePrefix || pathname.startsWith(`${rolePrefix}/`);
}

/**
 * Resolves a safe redirect URL post-authentication based on user role and candidate nextUrl.
 *
 * Rules:
 * 1. Rejects null, undefined, non-strings, and empty inputs -> fallback to canonical role home.
 * 2. Rejects non-relative paths (must start with "/" and not "//").
 * 3. Rejects backslash characters ('\') both before and after URI decoding.
 * 4. Rejects control characters and malformed URI sequences.
 * 5. Uses standard URL parsing with a fixed origin to normalize path traversals (e.g. "/account/../admin").
 * 6. Verifies origin matches local base exactly.
 * 7. Enforces protected role space isolation:
 *    - /account and /account/... belong strictly to CUSTOMER
 *    - /barber and /barber/... belong strictly to BARBER
 *    - /admin and /admin/... belong strictly to ADMIN
 * 8. If destination targets another role's space, fallback to canonical role home.
 * 9. Local public routes not in protected role spaces are permitted.
 */
export function resolveAuthRedirect(
  role: AuthRole,
  nextUrl?: string | null,
): string {
  const fallback = ROLE_HOMES[role] || "/account";

  if (!nextUrl || typeof nextUrl !== "string") {
    return fallback;
  }

  // Must be a relative path; reject protocol-relative (//) or backslash variants (/\)
  if (
    !nextUrl.startsWith("/") ||
    nextUrl.startsWith("//") ||
    nextUrl.includes("\\")
  ) {
    return fallback;
  }

  // Reject control characters
  if (/[\x00-\x1F\x7F]/.test(nextUrl)) {
    return fallback;
  }

  // Check percent-encoded backslashes and null/control bytes
  try {
    const decoded = decodeURIComponent(nextUrl);
    if (decoded.includes("\\") || /[\x00-\x1F\x7F]/.test(decoded)) {
      return fallback;
    }
  } catch {
    // Malformed URI encoding (e.g. '%')
    return fallback;
  }

  try {
    const parsed = new URL(nextUrl, "http://localhost");

    // Must match local dummy origin exactly
    if (parsed.origin !== "http://localhost") {
      return fallback;
    }

    const normalizedPath = parsed.pathname;

    // Reject if normalized path does not start with / or starts with // or has \
    if (
      !normalizedPath.startsWith("/") ||
      normalizedPath.startsWith("//") ||
      normalizedPath.includes("\\")
    ) {
      return fallback;
    }

    const isCustomerSpace = isRoleSpace(normalizedPath, "/account");
    const isBarberSpace = isRoleSpace(normalizedPath, "/barber");
    const isAdminSpace = isRoleSpace(normalizedPath, "/admin");

    // Cross-role boundary enforcement: if destination is in another role's space, fallback
    if (isCustomerSpace && role !== "CUSTOMER") {
      return fallback;
    }
    if (isBarberSpace && role !== "BARBER") {
      return fallback;
    }
    if (isAdminSpace && role !== "ADMIN") {
      return fallback;
    }

    // Return the safe relative destination preserving query and hash
    return `${normalizedPath}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
