import { uuidv7 } from "uuidv7";
import { User } from "../models/user.js";
import { StaffInvitationTransactionRunner } from "../ports/staff-invitation-transaction-runner.js";
import { PasswordHashingPort } from "../ports/password-hashing-port.js";
import { TokenPort } from "../ports/token-port.js";
import {
  IdentityError,
  InvalidStaffInvitationError,
  StaffInvitationExpiredError,
  StaffInvitationAlreadyUsedError,
  UserAlreadyExistsError,
} from "../errors.js";

export interface AcceptStaffInvitationInput {
  token: string;
  passwordRaw: string;
}

export interface AcceptStaffInvitationOutput {
  user: User;
}

export class AcceptStaffInvitationUseCase {
  constructor(
    private readonly transactionRunner: StaffInvitationTransactionRunner,
    private readonly passwordHashing: PasswordHashingPort,
    private readonly tokenPort: TokenPort,
  ) {}

  async execute(
    input: AcceptStaffInvitationInput,
  ): Promise<AcceptStaffInvitationOutput> {
    if (
      !input.token ||
      typeof input.token !== "string" ||
      input.token.trim() === ""
    ) {
      throw new IdentityError("Token undangan wajib diisi");
    }

    if (
      !input.passwordRaw ||
      typeof input.passwordRaw !== "string" ||
      input.passwordRaw.length < 8
    ) {
      throw new IdentityError("Password minimal 8 karakter");
    }

    const rawToken = input.token.trim();
    const tokenHash = await this.tokenPort.hashToken(rawToken);
    const passwordHash = await this.passwordHashing.hashPassword(
      input.passwordRaw,
    );

    const createdUser = await this.transactionRunner.run(
      async ({
        userRepository,
        staffInvitationRepository,
        barberProfileRepository,
      }) => {
        // 1. Acquire row lock on the invitation record (SELECT ... FOR UPDATE)
        const invitation =
          await staffInvitationRepository.findAndLockByTokenHash(tokenHash);

        if (!invitation) {
          throw new InvalidStaffInvitationError(
            "Undangan tidak valid atau tidak ditemukan",
          );
        }

        // 2. Revalidate single-use under lock
        if (invitation.usedAt !== null) {
          throw new StaffInvitationAlreadyUsedError("Undangan sudah digunakan");
        }

        // 3. Revalidate expiration under lock
        const now = new Date();
        if (invitation.expiresAt.getTime() <= now.getTime()) {
          throw new StaffInvitationExpiredError("Undangan sudah kedaluwarsa");
        }

        // 4. Validate that the Admin-provided displayName is present and non-blank
        if (!invitation.displayName || invitation.displayName.trim() === "") {
          throw new IdentityError(
            "Undangan staf memerlukan nama lengkap yang valid",
          );
        }

        // 5. Verify no existing user with this email
        const existingUser = await userRepository.findByEmail(invitation.email);
        if (existingUser) {
          throw new UserAlreadyExistsError(
            "Pengguna dengan email ini sudah terdaftar",
          );
        }

        // 6. Create User record with Admin-provided displayName and invited role
        const userId = uuidv7();
        const user = await userRepository.createUser({
          id: userId,
          email: invitation.email,
          displayName: invitation.displayName.trim(),
          passwordHash,
          role: invitation.role,
          status: "ACTIVE",
          emailVerifiedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        // 7. Mark invitation consumed
        await staffInvitationRepository.consumeInvitation(invitation.id, now);

        // 8. If role is BARBER, provision linked barber profile atomically
        if (invitation.role === "BARBER") {
          await barberProfileRepository.provisionProfile({
            id: uuidv7(),
            userId: user.id,
            specialization: null,
          });
        }

        return user;
      },
    );

    return { user: createdUser };
  }
}
