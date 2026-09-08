import { Service } from "../models/service.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { ServiceNotFoundError } from "../errors.js";

export interface GetServiceOptions {
  activeOnly?: boolean;
}

export class GetServiceUseCase {
  constructor(private readonly serviceRepository: ServiceRepository) {}

  async execute(id: string, options?: GetServiceOptions): Promise<Service> {
    const service = await this.serviceRepository.findById(id);
    if (!service) {
      throw new ServiceNotFoundError(id);
    }
    if (options?.activeOnly && !service.isActive) {
      throw new ServiceNotFoundError(id);
    }
    return service;
  }
}
