import { User } from "../models/user.js";
import { UserRepository } from "../ports/user-repository.js";
import { TokenPort } from "../ports/token-port.js";
import { SessionRepository } from "../ports/session-repository.js";

export class ResolveAuthenticatedUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenPort: TokenPort,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(
    rawSessionToken: string | null | undefined,
  ): Promise<User | null> {
    if (!rawSessionToken || typeof rawSessionToken !== "string") {
      return null;
    }

    // 1. Hash the raw token
    const tokenHash = await this.tokenPort.hashToken(rawSessionToken);

    // 2. Lookup active session
    // The repository is authoritative and ensures expired/revoked sessions are not returned.
    const session =
      await this.sessionRepository.findActiveSessionByTokenHash(tokenHash);
    if (!session) {
      return null;
    }

    // 3. Load user
    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      return null;
    }

    // 4. Verify user is ACTIVE
    if (user.status !== "ACTIVE") {
      return null;
    }

    // 5. Return safe user (exclude passwordHash if it was somehow fetched)
    const safeUser: User = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return safeUser;
  }
}
