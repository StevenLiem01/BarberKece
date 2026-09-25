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
  /**
   * Returns all barber profiles including displayName joined from users.
   * Named barbers (displayName non-null and non-blank) and unnamed barbers
   * are both returned; filtering for public display is done at the use-case
   * level.
   */
  findAll(): Promise<BarberProfile[]>;
  lockProfiles(ids: string[]): Promise<string[]>;
}
