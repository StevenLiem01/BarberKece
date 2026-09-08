import { Service } from "../models/service.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { ReservationError, ServiceNotFoundError } from "../errors.js";

export interface UpdateServiceInput {
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  priceRupiah?: number;
}

export class UpdateServiceUseCase {
  constructor(private readonly serviceRepository: ServiceRepository) {}

  async execute(id: string, input: UpdateServiceInput): Promise<Service> {
    if (input.name !== undefined && !input.name.trim()) {
      throw new ReservationError("Service name must not be empty");
    }
    if (
      input.durationMinutes !== undefined &&
      (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0)
    ) {
      throw new ReservationError("Duration must be a positive integer");
    }
    if (
      input.priceRupiah !== undefined &&
      (!Number.isInteger(input.priceRupiah) || input.priceRupiah < 0)
    ) {
      throw new ReservationError("Price must be a non-negative integer");
    }

    const params: {
      name?: string;
      description?: string | null;
      durationMinutes?: number;
      priceRupiah?: number;
    } = {};

    if (input.name !== undefined) params.name = input.name.trim();
    if (input.description !== undefined) params.description = input.description;
    if (input.durationMinutes !== undefined)
      params.durationMinutes = input.durationMinutes;
    if (input.priceRupiah !== undefined) params.priceRupiah = input.priceRupiah;

    try {
      return await this.serviceRepository.updateService(id, params);
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) {
        throw new ServiceNotFoundError(id);
      }
      throw err;
    }
  }
}
