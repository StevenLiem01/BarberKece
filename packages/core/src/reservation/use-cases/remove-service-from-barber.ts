import { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";
import { BarberProfileNotFoundError } from "../../barber/errors.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { ServiceNotFoundError } from "../errors.js";
import { BarberEligibilityRepository } from "../ports/barber-eligibility-repository.js";

export interface RemoveServiceFromBarberInput {
  barberProfileId: string;
  serviceId: string;
}

export class RemoveServiceFromBarberUseCase {
  constructor(
    private readonly barberProfileRepository: BarberProfileRepository,
    private readonly serviceRepository: ServiceRepository,
    private readonly eligibilityRepository: BarberEligibilityRepository,
  ) {}

  async execute(input: RemoveServiceFromBarberInput): Promise<void> {
    const profile = await this.barberProfileRepository.findById(
      input.barberProfileId,
    );
    if (!profile) {
      throw new BarberProfileNotFoundError(input.barberProfileId);
    }

    const service = await this.serviceRepository.findById(input.serviceId);
    if (!service) {
      throw new ServiceNotFoundError(input.serviceId);
    }

    await this.eligibilityRepository.removeService(
      input.barberProfileId,
      input.serviceId,
    );
  }
}
