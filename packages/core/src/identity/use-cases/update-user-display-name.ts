import { User } from "../models/user.js";
import { UserRepository } from "../ports/user-repository.js";
import { IdentityError } from "../errors.js";
import { DISPLAY_NAME_MAX_LENGTH } from "./register-customer.js";

export interface UpdateUserDisplayNameInput {
  userId: string;
  displayName: string;
}

/**
 * Updates the display_name for any user by ID.
 *
 * Authorization: callers MUST verify ADMIN role before invoking this use case.
 * This use case does not check roles itself; role enforcement is the caller's responsibility.
 *
 * Used by the Admin barber display-name recovery path to supply or correct a barber's name
 * without re-provisioning the entire user account.
 */
export class UpdateUserDisplayNameUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: UpdateUserDisplayNameInput): Promise<User> {
    const trimmed = input.displayName.trim();
    if (trimmed.length === 0) {
      throw new IdentityError("Display name must not be blank");
    }
    if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
      throw new IdentityError(
        `Display name must not exceed ${DISPLAY_NAME_MAX_LENGTH} characters`,
      );
    }

    const user = await this.userRepository.updateDisplayName(
      input.userId,
      trimmed,
    );

    return user;
  }
}
