import { eq } from "drizzle-orm";
import { Database } from "../client.js";
import { sessions } from "../schema/identity/sessions.js";
import {
  Session,
  SessionRepository,
  IdentityError,
} from "@barberkece/core/identity";

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async createSession(session: Session): Promise<Session> {
    try {
      const [inserted] = await this.db
        .insert(sessions)
        .values({
          id: session.id,
          userId: session.userId,
          tokenHash: session.tokenHash,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
        })
        .returning();

      if (!inserted) {
        throw new IdentityError("Failed to insert session");
      }

      return {
        id: inserted.id,
        userId: inserted.userId,
        tokenHash: inserted.tokenHash,
        expiresAt: inserted.expiresAt,
        createdAt: inserted.createdAt,
      };
    } catch {
      throw new IdentityError("Database error during session creation");
    }
  }

  async findActiveSessionByTokenHash(
    tokenHash: string,
  ): Promise<Session | null> {
    try {
      const session = await this.db.query.sessions.findFirst({
        where: eq(sessions.tokenHash, tokenHash),
      });

      if (!session) {
        return null;
      }

      // Strictly enforce expiration at the repository level
      if (session.expiresAt.getTime() <= Date.now()) {
        return null;
      }

      return {
        id: session.id,
        userId: session.userId,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      };
    } catch {
      throw new IdentityError("Database error during session lookup");
    }
  }

  async revokeSession(tokenHash: string): Promise<void> {
    try {
      await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    } catch {
      throw new IdentityError("Database error during session revocation");
    }
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    try {
      await this.db.delete(sessions).where(eq(sessions.userId, userId));
    } catch {
      throw new IdentityError("Database error during user session revocation");
    }
  }
}
