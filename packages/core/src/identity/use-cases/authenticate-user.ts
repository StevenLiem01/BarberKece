import { uuidv7 } from "uuidv7";
import { User } from "../models/user.js";
import { UserRepository } from "../ports/user-repository.js";
import { PasswordHashingPort } from "../ports/password-hashing-port.js";
import { TokenPort } from "../ports/token-port.js";
import { SessionRepository } from "../ports/session-repository.js";
import { IdentityError, AuthenticationError } from "../errors.js";

export interface AuthenticateUserInput {
  email: string;
  passwordRaw: string;
}

export interface AuthenticateUserResult {
  user: User;
  rawToken: string;
  expiresAt: Date;
}

/**
 * A precomputed Argon2id hash used to prevent timing attacks.
 * When a user is not found, this hash is verified against the provided password
 * to consume the same amount of CPU time as a valid login attempt.
 * Parameters: m=65536, t=3, p=4
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$jtQzDk2Wou5ajw8gQH5OHQ$HF2P1sx7ku5OaKtkb7I8iHyy+4x8TlKckBOpYfltdpQ";

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHashing: PasswordHashingPort,
    private readonly tokenPort: TokenPort,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthenticateUserResult> {
    if (!input.email || typeof input.email !== "string") {
      throw new IdentityError("Email is required");
    }
    if (!input.passwordRaw || typeof input.passwordRaw !== "string") {
      throw new IdentityError("Password is required");
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Find user by email
    const user = await this.userRepository.findByEmail(normalizedEmail);

    // We always verify against a hash to prevent timing-based user enumeration.
    // If the user doesn't exist, we verify against the dummy hash.
    const hashToVerify = user ? user.passwordHash : DUMMY_HASH;

    // 2. Verify password
    const isValid = await this.passwordHashing.verifyPassword(
      hashToVerify,
      input.passwordRaw,
    );

    // Fail indistinguishably if the user doesn't exist or the password is wrong
    if (!user || !isValid) {
      throw new AuthenticationError("Invalid email or password");
    }

    // 3. Check status
    if (user.status !== "ACTIVE") {
      throw new AuthenticationError("Account is inactive");
    }

    // 4. Generate and hash token
    const rawToken = await this.tokenPort.generateToken();
    const tokenHash = await this.tokenPort.hashToken(rawToken);

    // 5. Create Session
    const now = new Date();
    // Expires exactly 7 days after creation (604800 seconds)
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await this.sessionRepository.createSession({
      id: uuidv7(),
      userId: user.id,
      tokenHash,
      createdAt: now,
      expiresAt: expiresAt,
    });

    // 6. Return safe result
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

    return {
      user: safeUser,
      rawToken,
      expiresAt,
    };
  }
}
