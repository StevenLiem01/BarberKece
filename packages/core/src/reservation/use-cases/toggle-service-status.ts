import { Service } from "../models/service.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { ServiceNotFoundError } from "../errors.js";

export class ToggleServiceStatusUseCase {
  constructor(private readonly serviceRepository: ServiceRepository) {}

  async execute(id: string, isActive: boolean): Promise<Service> {
    try {
      return await this.serviceRepository.updateServiceStatus(id, isActive);
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) {
        throw new ServiceNotFoundError(id);
      }
      throw err;
    }
  }
}
