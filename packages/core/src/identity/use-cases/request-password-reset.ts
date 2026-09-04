import { uuidv7 } from "uuidv7";
import { UserRepository } from "../ports/user-repository.js";
import { PasswordResetTransactionRunner } from "../ports/password-reset-transaction-runner.js";
import { TokenPort } from "../ports/token-port.js";
import { EmailPort } from "../../email/ports/email-port.js";
import { IdentityError } from "../errors.js";

export interface RequestPasswordResetInput {
  email: string;
}

export interface RequestPasswordResetOutput {
  message: string;
}

export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly transactionRunner: PasswordResetTransactionRunner,
    private readonly tokenPort: TokenPort,
    private readonly emailPort: EmailPort,
    private readonly appUrl: string,
  ) {}

  async execute(
    input: RequestPasswordResetInput,
  ): Promise<RequestPasswordResetOutput> {
    if (
      !input.email ||
      typeof input.email !== "string" ||
      input.email.trim() === ""
    ) {
      throw new IdentityError("Email is required");
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    // Standard enumeration-safe generic response
    const genericSuccessResponse: RequestPasswordResetOutput = {
      message:
        "If your email is registered, you will receive password reset instructions shortly.",
    };

    // Lookup user
    const user = await this.userRepository.findByEmail(normalizedEmail);

    // UNKNOWN EMAIL or INELIGIBLE USER:
    // Strictly enumeration-safe: return generic success without generating token,
    // mutating DB, or triggering email side effects.
    if (!user || user.status !== "ACTIVE") {
      return genericSuccessResponse;
    }

    // KNOWN ELIGIBLE USER:
    // 1. Generate high-entropy raw token and deterministic hash
    const rawToken = await this.tokenPort.generateToken();
    const tokenHash = await this.tokenPort.hashToken(rawToken);
    const tokenId = uuidv7();

    const now = new Date();
    // Locked policy: 30 minutes / 1800 seconds TTL
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    // 2. Execute locked issuance transaction
    await this.transactionRunner.run(
      async ({ passwordResetTokenRepository }) => {
        // Acquire per-user transaction advisory lock
        await passwordResetTokenRepository.acquireUserIssuanceLock(user.id);

        // Invalidate all prior active, unused reset tokens for this user
        await passwordResetTokenRepository.invalidateActiveTokensForUser(
          user.id,
          now,
        );

        // Insert new token
        await passwordResetTokenRepository.createToken({
          id: tokenId,
          userId: user.id,
          tokenHash,
          expiresAt,
          usedAt: null,
          createdAt: now,
        });
      },
    );

    // 3. Side effect: Email dispatch strictly AFTER transaction commit
    const resetUrl = `${this.appUrl.replace(/\/$/, "")}/reset-password?token=${rawToken}`;

    await this.emailPort.sendEmail({
      to: user.email,
      subject: "Atur Ulang Kata Sandi - BarberKece",
      text: `Halo,\n\nAnda meminta pengaturan ulang kata sandi untuk akun BarberKece Anda.\nSilakan gunakan tautan berikut:\n${resetUrl}\n\nTautan ini berlaku selama 30 menit.\nJika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini.`,
      html: `<p>Halo,</p><p>Anda meminta pengaturan ulang kata sandi untuk akun BarberKece Anda.</p><p><a href="${resetUrl}">Klik di sini untuk mengatur ulang kata sandi</a></p><p>Tautan ini berlaku selama 30 menit.<br/>Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini.</p>`,
    });

    return genericSuccessResponse;
  }
}
