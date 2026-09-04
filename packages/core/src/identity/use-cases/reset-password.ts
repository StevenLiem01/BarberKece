import { PasswordResetTransactionRunner } from "../ports/password-reset-transaction-runner.js";
import { PasswordHashingPort } from "../ports/password-hashing-port.js";
import { TokenPort } from "../ports/token-port.js";
import { IdentityError } from "../errors.js";

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface ResetPasswordOutput {
  message: string;
}

export class ResetPasswordUseCase {
  constructor(
    private readonly transactionRunner: PasswordResetTransactionRunner,
    private readonly passwordHashing: PasswordHashingPort,
    private readonly tokenPort: TokenPort,
  ) {}

  async execute(input: ResetPasswordInput): Promise<ResetPasswordOutput> {
    if (
      !input.token ||
      typeof input.token !== "string" ||
      input.token.trim() === ""
    ) {
      throw new IdentityError("Reset token is required");
    }

    if (
      !input.newPassword ||
      typeof input.newPassword !== "string" ||
      input.newPassword.length < 8
    ) {
      throw new IdentityError("Password must be at least 8 characters long");
    }

    const rawToken = input.token.trim();
    const tokenHash = await this.tokenPort.hashToken(rawToken);
    const newPasswordHash = await this.passwordHashing.hashPassword(
      input.newPassword,
    );

    // Execute atomic confirmation transaction
    await this.transactionRunner.run(
      async ({
        userRepository,
        passwordResetTokenRepository,
        sessionRepository,
      }) => {
        // 1. Acquire row-level lock on token row (SELECT ... FOR UPDATE)
        const tokenRecord =
          await passwordResetTokenRepository.findAndLockByTokenHash(tokenHash);

        if (!tokenRecord) {
          throw new IdentityError("Invalid or expired password reset token");
        }

        // 2. Revalidate authoritative used_at and expires_at under lock
        const now = new Date();
        if (
          tokenRecord.usedAt !== null ||
          tokenRecord.expiresAt.getTime() <= now.getTime()
        ) {
          throw new IdentityError("Invalid or expired password reset token");
        }

        // 3. Update password in users table
        await userRepository.updatePassword(
          tokenRecord.userId,
          newPasswordHash,
        );

        // 4. Mark token as consumed (used_at = now)
        await passwordResetTokenRepository.consumeToken(tokenRecord.id, now);

        // 5. Revoke all active sessions for that user
        await sessionRepository.revokeAllSessionsForUser(tokenRecord.userId);
      },
    );

    return {
      message:
        "Password has been reset successfully. Please log in with your new password.",
    };
  }
}
