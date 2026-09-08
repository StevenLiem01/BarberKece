import { uuidv7 } from "uuidv7";
import { BarberProfile } from "../models/barber-profile.js";
import { BarberProfileRepository } from "../ports/barber-profile-repository.js";
import { BarberError } from "../errors.js";
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
      throw new BarberError(`User not found: ${input.userId}`);
    }
    if (user.role !== "BARBER") {
      throw new BarberError(
        `User ${input.userId} does not have the BARBER role`,
      );
    }

    // Delegate duplicate enforcement to the DB unique constraint.
    // The repository will throw on violation; we let it propagate.
    return this.barberProfileRepository.provisionProfile({
      id: uuidv7(),
      userId: input.userId,
      specialization: input.specialization ?? null,
    });
  }
}
