import { eq, and, isNull, gt, sql } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { staffInvitations } from "../schema/identity/staff_invitations.js";
import {
  StaffInvitation,
  StaffInvitationRepository,
  IdentityError,
} from "@barberkece/core/identity";

export class PostgresStaffInvitationRepository implements StaffInvitationRepository {
  constructor(private readonly db: DbOrTx) {}

  /**
   * Acquires a transaction-scoped advisory lock for the target staff email invitation issuance.
   * Serializes concurrent issuance operations for the normalized email without blocking other emails.
   */
  async acquireEmailIssuanceLock(email: string): Promise<void> {
    try {
      await this.db.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('staff_invitation_issuance'), hashtext(${email.toLowerCase().trim()}))`,
      );
    } catch {
      throw new IdentityError(
        "Database error during staff invitation lock acquisition",
      );
    }
  }

  /**
   * Inserts a new staff invitation record.
   * Only the hashed token is stored.
   */
  async createInvitation(
    invitation: StaffInvitation,
  ): Promise<StaffInvitation> {
    try {
      const [inserted] = await this.db
        .insert(staffInvitations)
        .values({
          id: invitation.id,
          email: invitation.email.toLowerCase().trim(),
          displayName: invitation.displayName,
          role: invitation.role,
          tokenHash: invitation.tokenHash,
          expiresAt: invitation.expiresAt,
          usedAt: invitation.usedAt,
          createdAt: invitation.createdAt,
        })
        .returning();

      if (!inserted) {
        throw new IdentityError("Failed to insert staff invitation");
      }

      return {
        id: inserted.id,
        email: inserted.email,
        displayName: inserted.displayName,
        role: inserted.role as "BARBER" | "ADMIN",
        tokenHash: inserted.tokenHash,
        expiresAt: inserted.expiresAt,
        usedAt: inserted.usedAt,
        createdAt: inserted.createdAt,
      };
    } catch (error: unknown) {
      if (error instanceof IdentityError) {
        throw error;
      }
      throw new IdentityError(
        "Database error during staff invitation creation",
      );
    }
  }

  /**
   * Invalidates all prior active, unused invitations for an email by setting used_at = now.
   * Condition: email = normalizedEmail AND used_at IS NULL AND expires_at > now.
   */
  async invalidateActiveInvitationsForEmail(
    email: string,
    now: Date,
  ): Promise<number> {
    try {
      const result = await this.db
        .update(staffInvitations)
        .set({
          usedAt: now,
        })
        .where(
          and(
            eq(staffInvitations.email, email.toLowerCase().trim()),
            isNull(staffInvitations.usedAt),
            gt(staffInvitations.expiresAt, now),
          ),
        )
        .returning({ id: staffInvitations.id });

      return result.length;
    } catch {
      throw new IdentityError(
        "Database error during staff invitation invalidation",
      );
    }
  }

  /**
   * Finds and acquires a row lock (SELECT ... FOR UPDATE) on a staff invitation by its tokenHash.
   */
  async findAndLockByTokenHash(
    tokenHash: string,
  ): Promise<StaffInvitation | null> {
    try {
      const [row] = await this.db
        .select()
        .from(staffInvitations)
        .where(eq(staffInvitations.tokenHash, tokenHash))
        .for("update");

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        role: row.role as "BARBER" | "ADMIN",
        tokenHash: row.tokenHash,
        expiresAt: row.expiresAt,
        usedAt: row.usedAt,
        createdAt: row.createdAt,
      };
    } catch {
      throw new IdentityError(
        "Database error during staff invitation lookup and locking",
      );
    }
  }

  /**
   * Finds a staff invitation by its tokenHash without row locking (for public status queries).
   */
  async findByTokenHash(tokenHash: string): Promise<StaffInvitation | null> {
    try {
      const [row] = await this.db
        .select()
        .from(staffInvitations)
        .where(eq(staffInvitations.tokenHash, tokenHash))
        .limit(1);

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        role: row.role as "BARBER" | "ADMIN",
        tokenHash: row.tokenHash,
        expiresAt: row.expiresAt,
        usedAt: row.usedAt,
        createdAt: row.createdAt,
      };
    } catch {
      throw new IdentityError("Database error during staff invitation lookup");
    }
  }

  /**
   * Consumes an invitation by setting used_at = consumedAt.
   */
  async consumeInvitation(id: string, consumedAt: Date): Promise<void> {
    try {
      await this.db
        .update(staffInvitations)
        .set({
          usedAt: consumedAt,
        })
        .where(eq(staffInvitations.id, id));
    } catch {
      throw new IdentityError(
        "Database error during staff invitation consumption",
      );
    }
  }
}
