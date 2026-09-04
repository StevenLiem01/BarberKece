import { eq, and, isNull, gt, sql } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { passwordResetTokens } from "../schema/identity/password_reset_tokens.js";
import {
  PasswordResetToken,
  PasswordResetTokenRepository,
  IdentityError,
} from "@barberkece/core/identity";

export class PostgresPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly db: DbOrTx) {}

  /**
   * Acquires a transaction-scoped advisory lock for the target user's password reset token issuance.
   * Serializes concurrent issuance operations for the authoritative userId without blocking other users.
   */
  async acquireUserIssuanceLock(userId: string): Promise<void> {
    try {
      await this.db.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('password_reset_issuance'), hashtext(${userId}))`,
      );
    } catch {
      throw new IdentityError(
        "Database error during password reset lock acquisition",
      );
    }
  }

  /**
   * Inserts a new hashed password reset token record.
   */
  async createToken(token: PasswordResetToken): Promise<PasswordResetToken> {
    try {
      const [inserted] = await this.db
        .insert(passwordResetTokens)
        .values({
          id: token.id,
          userId: token.userId,
          tokenHash: token.tokenHash,
          expiresAt: token.expiresAt,
          usedAt: token.usedAt,
          createdAt: token.createdAt,
        })
        .returning();

      if (!inserted) {
        throw new IdentityError("Failed to insert password reset token");
      }

      return {
        id: inserted.id,
        userId: inserted.userId,
        tokenHash: inserted.tokenHash,
        expiresAt: inserted.expiresAt,
        usedAt: inserted.usedAt,
        createdAt: inserted.createdAt,
      };
    } catch {
      throw new IdentityError(
        "Database error during password reset token creation",
      );
    }
  }

  /**
   * Invalidates all prior active, unused reset tokens for a user by setting used_at = now.
   * Invariant: user_id = userId AND used_at IS NULL AND expires_at > now.
   */
  async invalidateActiveTokensForUser(
    userId: string,
    now: Date,
  ): Promise<number> {
    try {
      const result = await this.db
        .update(passwordResetTokens)
        .set({
          usedAt: now,
        })
        .where(
          and(
            eq(passwordResetTokens.userId, userId),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, now),
          ),
        )
        .returning({ id: passwordResetTokens.id });

      return result.length;
    } catch {
      throw new IdentityError(
        "Database error during password reset token invalidation",
      );
    }
  }

  /**
   * Finds and acquires a row lock (SELECT ... FOR UPDATE) on a reset token by its tokenHash.
   */
  async findAndLockByTokenHash(
    tokenHash: string,
  ): Promise<PasswordResetToken | null> {
    try {
      const [row] = await this.db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash))
        .for("update");

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        userId: row.userId,
        tokenHash: row.tokenHash,
        expiresAt: row.expiresAt,
        usedAt: row.usedAt,
        createdAt: row.createdAt,
      };
    } catch {
      throw new IdentityError(
        "Database error during password reset token lookup and locking",
      );
    }
  }

  /**
   * Consumes a reset token by setting used_at = consumedAt.
   */
  async consumeToken(tokenId: string, consumedAt: Date): Promise<void> {
    try {
      await this.db
        .update(passwordResetTokens)
        .set({
          usedAt: consumedAt,
        })
        .where(eq(passwordResetTokens.id, tokenId));
    } catch {
      throw new IdentityError(
        "Database error during password reset token consumption",
      );
    }
  }
}
