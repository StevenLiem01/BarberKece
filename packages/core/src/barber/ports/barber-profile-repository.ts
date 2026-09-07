import { BarberProfile } from "../models/barber-profile.js";

export interface ProvisionBarberProfileParams {
  id: string;
  userId: string;
  specialization?: string | null;
}

export interface BarberProfileRepository {
  provisionProfile(
    params: ProvisionBarberProfileParams,
  ): Promise<BarberProfile>;
  updateSpecialization(
    id: string,
    specialization: string | null,
  ): Promise<BarberProfile>;
  findById(id: string): Promise<BarberProfile | null>;
  findByUserId(userId: string): Promise<BarberProfile | null>;
  findAll(): Promise<BarberProfile[]>;
}
