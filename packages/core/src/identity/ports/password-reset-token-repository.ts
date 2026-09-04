import { PasswordResetToken } from "../models/password-reset-token.js";

export interface PasswordResetTokenRepository {
  /**
   * Acquires a transaction-scoped advisory lock for the user's password reset token issuance.
   * Serializes concurrent issuance operations per user without blocking other users.
   * Automatically released at transaction commit or rollback.
   */
  acquireUserIssuanceLock(userId: string): Promise<void>;

  /**
   * Creates a new password reset token. Only the hashed token is stored.
   */
  createToken(token: PasswordResetToken): Promise<PasswordResetToken>;

  /**
   * Invalidates all prior active, unused reset tokens for a user by setting used_at = now.
   * Condition: user_id = userId AND used_at IS NULL AND expires_at > now.
   * Returns the count of invalidated tokens.
   */
  invalidateActiveTokensForUser(userId: string, now: Date): Promise<number>;

  /**
   * Finds and locks (FOR UPDATE) a password reset token by its tokenHash.
   */
  findAndLockByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;

  /**
   * Consumes a reset token by setting used_at = consumedAt.
   */
  consumeToken(tokenId: string, consumedAt: Date): Promise<void>;
}
