import { BarberProfile } from "../models/barber-profile.js";
import { BarberProfileRepository } from "../ports/barber-profile-repository.js";

/**
 * Returns all configured barber profiles for public display.
 *
 * Barbers with a NULL, empty, or whitespace-only displayName are excluded
 * from the public list per the product decision: unnamed barbers must not
 * appear in public barber discovery or customer-facing booking selection
 * until an Admin sets their real name.
 *
 * Admin endpoints use the repository directly to see all barbers including
 * unnamed ones.
 */
export interface ListBarbersOptions {
  /**
   * If true, returns all barbers including those without a valid display_name.
   * Intended for administrative management. Defaults to false.
   */
  includeUnnamed?: boolean;
}

export class ListBarbersUseCase {
  constructor(
    private readonly barberProfileRepository: BarberProfileRepository,
  ) {}

  async execute(options?: ListBarbersOptions): Promise<BarberProfile[]> {
    const all = await this.barberProfileRepository.findAll();
    if (options?.includeUnnamed) {
      return all;
    }
    // Filter out barbers whose displayName is null, empty, or whitespace-only.
    return all.filter(
      (b) => b.displayName !== null && b.displayName.trim().length > 0,
    );
  }
}
