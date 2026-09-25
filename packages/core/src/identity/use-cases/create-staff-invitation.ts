import { uuidv7 } from "uuidv7";
import { StaffInvitationTransactionRunner } from "../ports/staff-invitation-transaction-runner.js";
import { TokenPort } from "../ports/token-port.js";
import { EmailPort } from "../../email/ports/email-port.js";
import { IdentityError, UserAlreadyExistsError } from "../errors.js";
import { DISPLAY_NAME_MAX_LENGTH } from "./register-customer.js";

export interface CreateStaffInvitationInput {
  displayName: string;
  email: string;
  role: "BARBER" | "ADMIN";
}

export interface CreateStaffInvitationOutput {
  id: string;
  email: string;
  displayName: string | null;
  role: "BARBER" | "ADMIN";
  expiresAt: Date;
  createdAt: Date;
}

export class CreateStaffInvitationUseCase {
  constructor(
    private readonly transactionRunner: StaffInvitationTransactionRunner,
    private readonly tokenPort: TokenPort,
    private readonly emailPort: EmailPort,
    private readonly appUrl: string,
    private readonly tokenTtlMs: number = 48 * 60 * 60 * 1000, // 48 hours
  ) {}

  async execute(
    input: CreateStaffInvitationInput,
  ): Promise<CreateStaffInvitationOutput> {
    // 1. Validate display name
    if (!input.displayName || typeof input.displayName !== "string") {
      throw new IdentityError("Display name is required");
    }
    const trimmedDisplayName = input.displayName.trim();
    if (trimmedDisplayName.length === 0) {
      throw new IdentityError("Display name must not be blank");
    }
    if (trimmedDisplayName.length > DISPLAY_NAME_MAX_LENGTH) {
      throw new IdentityError(
        `Display name must not exceed ${DISPLAY_NAME_MAX_LENGTH} characters`,
      );
    }

    // 2. Validate email
    if (!input.email || typeof input.email !== "string") {
      throw new IdentityError("Email is required");
    }
    const normalizedEmail = input.email.trim().toLowerCase();
    if (
      !normalizedEmail.includes("@") ||
      normalizedEmail.startsWith("@") ||
      normalizedEmail.endsWith("@")
    ) {
      throw new IdentityError("Invalid email address");
    }

    // 3. Validate role
    if (input.role !== "BARBER" && input.role !== "ADMIN") {
      throw new IdentityError("Role must be either BARBER or ADMIN");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.tokenTtlMs);

    // 4. Generate cryptographically secure token and deterministic hash before transaction
    const rawToken = await this.tokenPort.generateToken();
    const tokenHash = await this.tokenPort.hashToken(rawToken);

    // 5. Execute locked issuance within one database transaction
    const invitation = await this.transactionRunner.run(
      async ({ userRepository, staffInvitationRepository }) => {
        // 5a. Acquire transaction-scoped advisory lock for this normalized email to serialize concurrent invitations
        await staffInvitationRepository.acquireEmailIssuanceLock(
          normalizedEmail,
        );

        // 5b. Verify no active or existing user with this email under lock
        const existingUser = await userRepository.findByEmail(normalizedEmail);
        if (existingUser) {
          throw new UserAlreadyExistsError(
            "User with this email already exists",
          );
        }

        // 5c. Invalidate prior active, unused invitations for this email within transaction
        await staffInvitationRepository.invalidateActiveInvitationsForEmail(
          normalizedEmail,
          now,
        );

        // 5d. Persist invitation (hash only, never raw token)
        return await staffInvitationRepository.createInvitation({
          id: uuidv7(),
          email: normalizedEmail,
          displayName: trimmedDisplayName,
          role: input.role,
          tokenHash,
          expiresAt,
          usedAt: null,
          createdAt: now,
        });
      },
    );

    // 6. Dispatch transactional invitation email strictly AFTER transaction commit
    const invitationUrl = `${this.appUrl.replace(/\/$/, "")}/invitations/${rawToken}`;
    const roleLabel = input.role === "BARBER" ? "Barber" : "Admin";

    await this.emailPort.sendEmail({
      to: normalizedEmail,
      subject: "Undangan Bergabung Staf BarberKece",
      text: `Halo ${trimmedDisplayName},\n\nAnda diundang untuk bergabung dengan tim BarberKece sebagai ${roleLabel}.\nSilakan gunakan tautan berikut untuk melengkapi pendaftaran akun Anda:\n${invitationUrl}\n\nTautan ini berlaku selama 48 jam.\nJika Anda tidak merasa diundang, silakan abaikan email ini.`,
      html: `<p>Halo <strong>${trimmedDisplayName}</strong>,</p><p>Anda diundang untuk bergabung dengan tim BarberKece sebagai <strong>${roleLabel}</strong>.</p><p><a href="${invitationUrl}">Klik di sini untuk melengkapi pendaftaran akun staf Anda</a></p><p>Tautan ini berlaku selama 48 jam.<br/>Jika Anda tidak merasa diundang, silakan abaikan email ini.</p>`,
    });

    // 7. Return created invitation metadata (strictly no raw token in response)
    return {
      id: invitation.id,
      email: invitation.email,
      displayName: invitation.displayName,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }
}
