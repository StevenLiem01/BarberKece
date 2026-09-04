import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResetPasswordUseCase } from "../use-cases/reset-password.js";
import { UserRepository } from "../ports/user-repository.js";
import { PasswordResetTokenRepository } from "../ports/password-reset-token-repository.js";
import { PasswordResetTransactionRunner } from "../ports/password-reset-transaction-runner.js";
import { SessionRepository } from "../ports/session-repository.js";
import { PasswordHashingPort } from "../ports/password-hashing-port.js";
import { TokenPort } from "../ports/token-port.js";
import { IdentityError } from "../errors.js";
import { PasswordResetToken } from "../models/password-reset-token.js";

describe("ResetPasswordUseCase", () => {
  const mockUserRepository: UserRepository = {
    createUser: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    countByRole: vi.fn(),
    updatePassword: vi.fn(),
  };

  const mockPasswordResetTokenRepository: PasswordResetTokenRepository = {
    acquireUserIssuanceLock: vi.fn(),
    createToken: vi.fn(),
    invalidateActiveTokensForUser: vi.fn(),
    findAndLockByTokenHash: vi.fn(),
    consumeToken: vi.fn(),
  };

  const mockSessionRepository: SessionRepository = {
    createSession: vi.fn(),
    findActiveSessionByTokenHash: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllSessionsForUser: vi.fn(),
  };

  const mockTransactionRunner: PasswordResetTransactionRunner = {
    run: vi.fn(async (work) =>
      work({
        userRepository: mockUserRepository,
        passwordResetTokenRepository: mockPasswordResetTokenRepository,
        sessionRepository: mockSessionRepository,
      }),
    ),
  };

  const mockPasswordHashing: PasswordHashingPort = {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
  };

  const mockTokenPort: TokenPort = {
    generateToken: vi.fn(),
    hashToken: vi.fn(),
  };

  let useCase: ResetPasswordUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ResetPasswordUseCase(
      mockTransactionRunner,
      mockPasswordHashing,
      mockTokenPort,
    );
  });

  const validTokenRecord: PasswordResetToken = {
    id: "token-uuid-1",
    userId: "user-uuid-1",
    tokenHash: "hashed-raw-token",
    expiresAt: new Date(Date.now() + 1800000), // 30 minutes in future
    usedAt: null,
    createdAt: new Date(),
  };

  it("should throw IdentityError if token is empty", async () => {
    await expect(
      useCase.execute({ token: "", newPassword: "ValidPassword123" }),
    ).rejects.toThrow(new IdentityError("Reset token is required"));
  });

  it("should throw IdentityError if password is shorter than 8 characters", async () => {
    await expect(
      useCase.execute({ token: "raw-token", newPassword: "short" }),
    ).rejects.toThrow(
      new IdentityError("Password must be at least 8 characters long"),
    );
  });

  it("should successfully reset password, consume token, and revoke all sessions for valid active token", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("hashed-raw-token");
    vi.mocked(
      mockPasswordResetTokenRepository.findAndLockByTokenHash,
    ).mockResolvedValue(validTokenRecord);
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValue(
      "new-argon2-hash",
    );

    const result = await useCase.execute({
      token: "raw-token",
      newPassword: "NewSecurePassword123",
    });

    expect(result.message).toBe(
      "Password has been reset successfully. Please log in with your new password.",
    );

    // 1. Token looked up and locked with hash
    expect(mockTokenPort.hashToken).toHaveBeenCalledWith("raw-token");
    expect(
      mockPasswordResetTokenRepository.findAndLockByTokenHash,
    ).toHaveBeenCalledWith("hashed-raw-token");

    // 2. Password hashed and updated in user repository
    expect(mockPasswordHashing.hashPassword).toHaveBeenCalledWith(
      "NewSecurePassword123",
    );
    expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(
      validTokenRecord.userId,
      "new-argon2-hash",
    );

    // 3. Token marked consumed with current timestamp
    expect(mockPasswordResetTokenRepository.consumeToken).toHaveBeenCalledWith(
      validTokenRecord.id,
      expect.any(Date),
    );

    // 4. All active sessions revoked for user
    expect(mockSessionRepository.revokeAllSessionsForUser).toHaveBeenCalledWith(
      validTokenRecord.userId,
    );
  });

  it("should reject and not update password or revoke sessions if token does not exist", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("non-existent-hash");
    vi.mocked(
      mockPasswordResetTokenRepository.findAndLockByTokenHash,
    ).mockResolvedValue(null);

    await expect(
      useCase.execute({
        token: "non-existent-token",
        newPassword: "NewSecurePassword123",
      }),
    ).rejects.toThrow(
      new IdentityError("Invalid or expired password reset token"),
    );

    expect(mockUserRepository.updatePassword).not.toHaveBeenCalled();
    expect(
      mockPasswordResetTokenRepository.consumeToken,
    ).not.toHaveBeenCalled();
    expect(
      mockSessionRepository.revokeAllSessionsForUser,
    ).not.toHaveBeenCalled();
  });

  it("should reject if token is expired", async () => {
    const expiredTokenRecord: PasswordResetToken = {
      ...validTokenRecord,
      expiresAt: new Date(Date.now() - 1000), // expired 1s ago
    };

    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("expired-hash");
    vi.mocked(
      mockPasswordResetTokenRepository.findAndLockByTokenHash,
    ).mockResolvedValue(expiredTokenRecord);

    await expect(
      useCase.execute({
        token: "expired-token",
        newPassword: "NewSecurePassword123",
      }),
    ).rejects.toThrow(
      new IdentityError("Invalid or expired password reset token"),
    );

    expect(mockUserRepository.updatePassword).not.toHaveBeenCalled();
    expect(
      mockPasswordResetTokenRepository.consumeToken,
    ).not.toHaveBeenCalled();
    expect(
      mockSessionRepository.revokeAllSessionsForUser,
    ).not.toHaveBeenCalled();
  });

  it("should reject if token has already been used", async () => {
    const usedTokenRecord: PasswordResetToken = {
      ...validTokenRecord,
      usedAt: new Date(Date.now() - 60000), // used 1m ago
    };

    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("used-hash");
    vi.mocked(
      mockPasswordResetTokenRepository.findAndLockByTokenHash,
    ).mockResolvedValue(usedTokenRecord);

    await expect(
      useCase.execute({
        token: "used-token",
        newPassword: "NewSecurePassword123",
      }),
    ).rejects.toThrow(
      new IdentityError("Invalid or expired password reset token"),
    );

    expect(mockUserRepository.updatePassword).not.toHaveBeenCalled();
    expect(
      mockPasswordResetTokenRepository.consumeToken,
    ).not.toHaveBeenCalled();
    expect(
      mockSessionRepository.revokeAllSessionsForUser,
    ).not.toHaveBeenCalled();
  });
});
