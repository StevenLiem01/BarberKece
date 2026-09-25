import { StaffInvitation } from "../models/staff-invitation.js";

export interface StaffInvitationRepository {
  /**
   * Acquires a transaction-scoped advisory lock for the target staff email invitation issuance.
   * Serializes concurrent issuance operations for the normalized email without blocking other emails.
   */
  acquireEmailIssuanceLock(email: string): Promise<void>;

  /**
   * Inserts a new staff invitation record.
   * Only the hashed token is stored.
   */
  createInvitation(invitation: StaffInvitation): Promise<StaffInvitation>;

  /**
   * Invalidates all prior active, unused invitations for an email by setting used_at = now.
   * Condition: email = normalizedEmail AND used_at IS NULL AND expires_at > now.
   * Returns the count of invalidated invitations.
   */
  invalidateActiveInvitationsForEmail(
    email: string,
    now: Date,
  ): Promise<number>;

  /**
   * Finds and acquires a row lock (SELECT ... FOR UPDATE) on a staff invitation by its tokenHash.
   */
  findAndLockByTokenHash(tokenHash: string): Promise<StaffInvitation | null>;

  /**
   * Finds a staff invitation by its tokenHash without row locking (for public status queries).
   */
  findByTokenHash(tokenHash: string): Promise<StaffInvitation | null>;

  /**
   * Consumes an invitation by setting used_at = consumedAt.
   */
  consumeInvitation(id: string, consumedAt: Date): Promise<void>;
}
