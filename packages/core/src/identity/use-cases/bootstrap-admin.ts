import { uuidv7 } from "uuidv7";
import { User } from "../models/user.js";
import { UserRepository } from "../ports/user-repository.js";
import { PasswordHashingPort } from "../ports/password-hashing-port.js";
import { IdentityError } from "../errors.js";

export interface BootstrapAdminInput {
  email: string;
  passwordRaw: string;
}

export class BootstrapAdminUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHashing: PasswordHashingPort,
  ) {}

  async execute(input: BootstrapAdminInput): Promise<User> {
    if (!input.email || typeof input.email !== "string") {
      throw new IdentityError("Email is required");
    }
    if (!input.passwordRaw || typeof input.passwordRaw !== "string") {
      throw new IdentityError("Password is required");
    }
    if (input.passwordRaw.length < 8) {
      throw new IdentityError("Password must be at least 8 characters");
    }

    // Canonical policy: strictly first-admin-only.
    // Additional admins must be provisioned through the authorized admin flow.
    const adminCount = await this.userRepository.countByRole("ADMIN");
    if (adminCount > 0) {
      throw new IdentityError(
        "An ADMIN account already exists. Additional admins must be provisioned through the authorized admin flow.",
      );
    }

    // Normalize email consistently
    const normalizedEmail = input.email.trim().toLowerCase();

    // Check if email already registered under another role (e.g. CUSTOMER)
    const existing = await this.userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new IdentityError("Email is already registered");
    }

    // Hash password with Argon2id
    const passwordHash = await this.passwordHashing.hashPassword(
      input.passwordRaw,
    );

    const now = new Date();

    // Persist ADMIN user with ACTIVE status
    const user = await this.userRepository.createUser({
      id: uuidv7(),
      email: normalizedEmail,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });

    return user;
  }
}
