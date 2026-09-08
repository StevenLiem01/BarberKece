import { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";
import { BarberProfileNotFoundError } from "../../barber/errors.js";
import { BarberEligibilityRepository } from "../ports/barber-eligibility-repository.js";
import { Service } from "../models/service.js";

export interface GetBarberEligibleServicesInput {
  barberProfileId: string;
  activeOnly?: boolean;
}

export class GetBarberEligibleServicesUseCase {
  constructor(
    private readonly barberProfileRepository: BarberProfileRepository,
    private readonly eligibilityRepository: BarberEligibilityRepository,
  ) {}

  async execute(input: GetBarberEligibleServicesInput): Promise<Service[]> {
    const profile = await this.barberProfileRepository.findById(
      input.barberProfileId,
    );
    if (!profile) {
      throw new BarberProfileNotFoundError(input.barberProfileId);
    }

    const services = await this.eligibilityRepository.findServicesByBarberId(
      input.barberProfileId,
    );
    if (input.activeOnly) {
      return services.filter((s) => s.isActive);
    }
    return services;
  }
}
