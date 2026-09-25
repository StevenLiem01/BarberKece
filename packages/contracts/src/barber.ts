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

/**
 * Public-facing barber DTO.
 * - Does NOT expose userId (internal identity).
 * - displayName is null only when the user has no name set; such barbers
 *   are filtered out of public endpoints at the use-case level.
 */
export interface PublicBarberDto {
  id: string;
  displayName: string | null;
  specialization: string | null;
}

/**
 * Admin-facing barber DTO. Extends public DTO with internal userId so
 * Admin can identify which user account to update.
 * Also exposes whether displayName is missing so Admin dashboards can
 * surface the recovery warning.
 */
export interface AdminBarberDto extends PublicBarberDto {
  userId: string;
  missingDisplayName: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toPublicBarberDto(barber: {
  id: string;
  displayName: string | null;
  specialization: string | null;
}): PublicBarberDto {
  return {
    id: barber.id,
    displayName: barber.displayName,
    specialization: barber.specialization,
  };
}

export function toAdminBarberDto(barber: {
  id: string;
  userId: string;
  displayName: string | null;
  specialization: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminBarberDto {
  const trimmedName = barber.displayName?.trim() ?? null;
  return {
    id: barber.id,
    userId: barber.userId,
    displayName: trimmedName,
    specialization: barber.specialization,
    missingDisplayName: !trimmedName,
    createdAt: barber.createdAt.toISOString(),
    updatedAt: barber.updatedAt.toISOString(),
  };
}
