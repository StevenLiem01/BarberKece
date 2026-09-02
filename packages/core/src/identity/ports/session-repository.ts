import { Session } from "../models/session.js";

export interface SessionRepository {
  /**
   * Creates a new session in the repository.
   * Only the token hash should be stored, NEVER the raw token.
   *
   * @param session The complete session entity to store.
   * @returns The stored session.
   */
  createSession(session: Session): Promise<Session>;

  /**
   * Finds an active session by its deterministic token hash.
   * The repository must ensure that expired sessions are NOT returned as active.
   *
   * @param tokenHash The hash of the session token.
   * @returns The active session, or null if not found or expired.
   */
  findActiveSessionByTokenHash(tokenHash: string): Promise<Session | null>;

  /**
   * Revokes (deletes or marks invalid) a session by its token hash.
   *
   * @param tokenHash The hash of the session token to revoke.
   */
  revokeSession(tokenHash: string): Promise<void>;

  /**
   * Revokes all sessions for a specific user.
   * Useful for password resets or administrative forced logouts.
   *
   * @param userId The ID of the user whose sessions should be revoked.
   */
  revokeAllSessionsForUser(userId: string): Promise<void>;
}
