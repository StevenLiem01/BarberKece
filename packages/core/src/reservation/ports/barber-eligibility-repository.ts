import { Service } from "../models/service.js";

export interface BarberEligibilityRepository {
  assignService(barberProfileId: string, serviceId: string): Promise<void>;
  removeService(barberProfileId: string, serviceId: string): Promise<void>;
  findServicesByBarberId(barberProfileId: string): Promise<Service[]>;
  isEligible(barberProfileId: string, serviceId: string): Promise<boolean>;
  findEligibleBarberProfileIds(serviceId: string): Promise<string[]>;
}
