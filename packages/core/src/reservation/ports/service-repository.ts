import { Service } from "../models/service.js";

export interface CreateServiceParams {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceRupiah: number;
  isActive?: boolean;
}

export interface UpdateServiceParams {
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  priceRupiah?: number;
}

export interface ServiceRepository {
  createService(params: CreateServiceParams): Promise<Service>;
  updateService(id: string, params: UpdateServiceParams): Promise<Service>;
  updateServiceStatus(id: string, isActive: boolean): Promise<Service>;
  findById(id: string): Promise<Service | null>;
  findAll(): Promise<Service[]>;
  findActive(): Promise<Service[]>;
}
