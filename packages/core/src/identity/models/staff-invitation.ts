export interface StaffInvitation {
  id: string;
  email: string;
  displayName: string | null;
  role: "BARBER" | "ADMIN";
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}
