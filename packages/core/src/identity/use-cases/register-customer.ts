import { uuidv7 } from "uuidv7";
import { User } from "../models/user.js";
import { UserRepository } from "../ports/user-repository.js";
import { PasswordHashingPort } from "../ports/password-hashing-port.js";
import { IdentityError } from "../errors.js";

/** Maximum allowed byte-length for a display name. Supports international characters. */
export const DISPLAY_NAME_MAX_LENGTH = 100;

export interface RegisterCustomerInput {
  email: string;
  passwordRaw: string;
  displayName: string;
}

export class RegisterCustomerUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHashing: PasswordHashingPort,
  ) {}

  async execute(input: RegisterCustomerInput): Promise<User> {
    if (!input.email || typeof input.email !== "string") {
      throw new IdentityError("Email is required");
    }
    if (!input.passwordRaw || typeof input.passwordRaw !== "string") {
      throw new IdentityError("Password is required");
    }
    if (input.passwordRaw.length < 8) {
      throw new IdentityError("Password must be at least 8 characters");
    }

    // Validate display name: required, must be non-blank after trimming,
    // must not exceed the maximum length.
    if (!input.displayName || typeof input.displayName !== "string") {
      throw new IdentityError("Display name is required");
    }
    const trimmedName = input.displayName.trim();
    if (trimmedName.length === 0) {
      throw new IdentityError("Display name must not be blank");
    }
    if (trimmedName.length > DISPLAY_NAME_MAX_LENGTH) {
      throw new IdentityError(
        `Display name must not exceed ${DISPLAY_NAME_MAX_LENGTH} characters`,
      );
    }

    // Normalize email consistently
    const normalizedEmail = input.email.trim().toLowerCase();

    // Hash password
    const passwordHash = await this.passwordHashing.hashPassword(
      input.passwordRaw,
    );

    const now = new Date();

    // Persist user. The repository will throw an IdentityError on duplicate email.
    // Public registration always creates CUSTOMER and defaults to ACTIVE.
    const user = await this.userRepository.createUser({
      id: uuidv7(),
      email: normalizedEmail,
      displayName: trimmedName,
      passwordHash,
      role: "CUSTOMER",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });

    return user;
  }
}
