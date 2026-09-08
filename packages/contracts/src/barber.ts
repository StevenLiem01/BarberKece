import { z } from "zod";

export const ProvisionBarberProfileSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  specialization: z.string().trim().nullable().optional(),
});

export type ProvisionBarberProfileRequest = z.infer<
  typeof ProvisionBarberProfileSchema
>;

export const UpdateBarberProfileSchema = z.object({
  specialization: z.string().trim().nullable().optional(),
});

export type UpdateBarberProfileRequest = z.infer<
  typeof UpdateBarberProfileSchema
>;

export interface PublicBarberDto {
  id: string;
  specialization: string | null;
}

export interface AdminBarberDto extends PublicBarberDto {
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export function toPublicBarberDto(barber: {
  id: string;
  specialization: string | null;
}): PublicBarberDto {
  return {
    id: barber.id,
    specialization: barber.specialization,
  };
}

export function toAdminBarberDto(barber: {
  id: string;
  userId: string;
  specialization: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminBarberDto {
  return {
    id: barber.id,
    userId: barber.userId,
    specialization: barber.specialization,
    createdAt: barber.createdAt.toISOString(),
    updatedAt: barber.updatedAt.toISOString(),
  };
}
