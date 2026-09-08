import { uuidv7 } from "uuidv7";
import { Service } from "../models/service.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { ReservationError } from "../errors.js";

export interface CreateServiceInput {
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceRupiah: number;
}

export class CreateServiceUseCase {
  constructor(private readonly serviceRepository: ServiceRepository) {}

  async execute(input: CreateServiceInput): Promise<Service> {
    if (!input.name || !input.name.trim()) {
      throw new ReservationError("Service name is required");
    }
    if (
      !Number.isInteger(input.durationMinutes) ||
      input.durationMinutes <= 0
    ) {
      throw new ReservationError("Duration must be a positive integer");
    }
    if (!Number.isInteger(input.priceRupiah) || input.priceRupiah < 0) {
      throw new ReservationError("Price must be a non-negative integer");
    }

    return this.serviceRepository.createService({
      id: uuidv7(),
      name: input.name.trim(),
      description: input.description ?? null,
      durationMinutes: input.durationMinutes,
      priceRupiah: input.priceRupiah,
      isActive: true,
    });
  }
}
