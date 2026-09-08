import { uuidv7 } from "uuidv7";
import { BarberProfile } from "../models/barber-profile.js";
import { BarberProfileRepository } from "../ports/barber-profile-repository.js";
import {
  BarberUserNotFoundError,
  InvalidBarberRoleError,
  BarberProfileAlreadyExistsError,
} from "../errors.js";
import { UserRepository } from "../../identity/ports/user-repository.js";

export interface ProvisionBarberProfileInput {
  userId: string;
  specialization?: string | null;
}

export class ProvisionBarberProfileUseCase {
  constructor(
    private readonly barberProfileRepository: BarberProfileRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: ProvisionBarberProfileInput): Promise<BarberProfile> {
    // Verify user exists and has BARBER role
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new BarberUserNotFoundError(input.userId);
    }
    if (user.role !== "BARBER") {
      throw new InvalidBarberRoleError(input.userId, user.role);
    }

    // Application-level pre-check
    const existing = await this.barberProfileRepository.findByUserId(
      input.userId,
    );
    if (existing) {
      throw new BarberProfileAlreadyExistsError(input.userId);
    }

    // Delegate final insertion and race enforcement to the repository/database
    return this.barberProfileRepository.provisionProfile({
      id: uuidv7(),
      userId: input.userId,
      specialization: input.specialization ?? null,
    });
  }
}
