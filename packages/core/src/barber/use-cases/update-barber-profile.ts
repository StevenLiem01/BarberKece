import { BarberProfile } from "../models/barber-profile.js";
import { BarberProfileRepository } from "../ports/barber-profile-repository.js";
import { BarberProfileNotFoundError } from "../errors.js";

export interface UpdateBarberProfileInput {
  specialization?: string | null;
}

export class UpdateBarberProfileUseCase {
  constructor(
    private readonly barberProfileRepository: BarberProfileRepository,
  ) {}

  async execute(
    id: string,
    input: UpdateBarberProfileInput,
  ): Promise<BarberProfile> {
    if (input.specialization === undefined) {
      const profile = await this.barberProfileRepository.findById(id);
      if (!profile) {
        throw new BarberProfileNotFoundError(id);
      }
      return profile;
    }

    try {
      return await this.barberProfileRepository.updateSpecialization(
        id,
        input.specialization,
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) {
        throw new BarberProfileNotFoundError(id);
      }
      throw err;
    }
  }
}
