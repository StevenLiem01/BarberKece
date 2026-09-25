import { StaffInvitationRepository } from "../ports/staff-invitation-repository.js";
import { UserRepository } from "../ports/user-repository.js";
import { TokenPort } from "../ports/token-port.js";

export interface ValidateStaffInvitationInput {
  token: string;
}

export interface ValidateStaffInvitationOutput {
  isValid: boolean;
  email?: string;
  displayName?: string | null;
  role?: "BARBER" | "ADMIN";
  reason?: "EXPIRED" | "USED" | "NOT_FOUND" | "USER_ALREADY_EXISTS";
}

export class ValidateStaffInvitationUseCase {
  constructor(
    private readonly staffInvitationRepository: StaffInvitationRepository,
    private readonly tokenPort: TokenPort,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(
    input: ValidateStaffInvitationInput,
  ): Promise<ValidateStaffInvitationOutput> {
    if (
      !input.token ||
      typeof input.token !== "string" ||
      input.token.trim() === ""
    ) {
      return {
        isValid: false,
        reason: "NOT_FOUND",
      };
    }

    const rawToken = input.token.trim();
    const tokenHash = await this.tokenPort.hashToken(rawToken);

    const invitation =
      await this.staffInvitationRepository.findByTokenHash(tokenHash);

    if (!invitation) {
      return {
        isValid: false,
        reason: "NOT_FOUND",
      };
    }

    if (invitation.usedAt !== null) {
      return {
        isValid: false,
        reason: "USED",
        email: invitation.email,
        displayName: invitation.displayName,
        role: invitation.role,
      };
    }

    const now = new Date();
    if (invitation.expiresAt.getTime() <= now.getTime()) {
      return {
        isValid: false,
        reason: "EXPIRED",
        email: invitation.email,
        displayName: invitation.displayName,
        role: invitation.role,
      };
    }

    const existingUser = await this.userRepository.findByEmail(
      invitation.email,
    );
    if (existingUser) {
      return {
        isValid: false,
        reason: "USER_ALREADY_EXISTS",
        email: invitation.email,
        displayName: invitation.displayName,
        role: invitation.role,
      };
    }

    return {
      isValid: true,
      email: invitation.email,
      displayName: invitation.displayName,
      role: invitation.role,
    };
  }
}
