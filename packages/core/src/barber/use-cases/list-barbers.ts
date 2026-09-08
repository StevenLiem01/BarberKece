import { BarberProfile } from "../models/barber-profile.js";
import { BarberProfileRepository } from "../ports/barber-profile-repository.js";

export class ListBarbersUseCase {
  constructor(
    private readonly barberProfileRepository: BarberProfileRepository,
  ) {}

  /**
   * List all configured barber profiles.
   * M2 schema does not include an is_active column on barber_profiles.
   * Filtering by availability (schedules, leave, etc.) is a future M3 concern.
   */
  async execute(): Promise<BarberProfile[]> {
    return this.barberProfileRepository.findAll();
  }
}
