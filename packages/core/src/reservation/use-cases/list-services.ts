import { Service } from "../models/service.js";
import { ServiceRepository } from "../ports/service-repository.js";

export type ListServicesFilter = "all" | "active";

export class ListServicesUseCase {
  constructor(private readonly serviceRepository: ServiceRepository) {}

  /**
   * List services.
   * - filter "all": returns all services (admin view).
   * - filter "active": returns only active services (public/customer view).
   */
  async execute(filter: ListServicesFilter = "active"): Promise<Service[]> {
    if (filter === "all") {
      return this.serviceRepository.findAll();
    }
    return this.serviceRepository.findActive();
  }
}
