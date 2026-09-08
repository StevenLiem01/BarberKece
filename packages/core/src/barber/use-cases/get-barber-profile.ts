import { BarberProfile } from "../models/barber-profile.js";
import { BarberProfileRepository } from "../ports/barber-profile-repository.js";
import { BarberProfileNotFoundError } from "../errors.js";

export class GetBarberProfileUseCase {
  constructor(
    private readonly barberProfileRepository: BarberProfileRepository,
  ) {}

  async execute(id: string): Promise<BarberProfile> {
    const profile = await this.barberProfileRepository.findById(id);
    if (!profile) {
      throw new BarberProfileNotFoundError(id);
    }
    return profile;
  }
}
