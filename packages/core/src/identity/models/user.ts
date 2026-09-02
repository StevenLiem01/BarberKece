export type UserRole = "CUSTOMER" | "BARBER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED" | "PENDING";

export interface User {
  id: string;
  email: string;
  // passwordHash is deliberately omitted from the domain model read model
  // to ensure it is never returned to clients or logged by default.
  // We handle it explicitly where needed (e.g. login).
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithPasswordHash extends User {
  passwordHash: string;
}
