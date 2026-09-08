import { z } from "zod";

export const CreateServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required"),
  durationMinutes: z
    .number()
    .int("Duration must be an integer")
    .positive("Duration must be positive"),
  priceRupiah: z
    .number()
    .int("Price must be an integer")
    .nonnegative("Price must be non-negative"),
  description: z.string().trim().nullable().optional(),
});

export type CreateServiceRequest = z.infer<typeof CreateServiceSchema>;

export const UpdateServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required").optional(),
  durationMinutes: z
    .number()
    .int("Duration must be an integer")
    .positive("Duration must be positive")
    .optional(),
  priceRupiah: z
    .number()
    .int("Price must be an integer")
    .nonnegative("Price must be non-negative")
    .optional(),
  description: z.string().trim().nullable().optional(),
});

export type UpdateServiceRequest = z.infer<typeof UpdateServiceSchema>;

export const ToggleServiceStatusSchema = z.object({
  isActive: z.boolean(),
});

export type ToggleServiceStatusRequest = z.infer<
  typeof ToggleServiceStatusSchema
>;

export const AssignServiceToBarberSchema = z.object({
  serviceId: z.string().uuid("Invalid service ID format"),
});

export type AssignServiceToBarberRequest = z.infer<
  typeof AssignServiceToBarberSchema
>;

export interface PublicServiceDto {
  id: string;
  name: string;
  durationMinutes: number;
  priceRupiah: number;
  description: string | null;
}

export interface AdminServiceDto extends PublicServiceDto {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toPublicServiceDto(service: {
  id: string;
  name: string;
  durationMinutes: number;
  priceRupiah: number;
  description: string | null;
}): PublicServiceDto {
  return {
    id: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    priceRupiah: service.priceRupiah,
    description: service.description,
  };
}

export function toAdminServiceDto(service: {
  id: string;
  name: string;
  durationMinutes: number;
  priceRupiah: number;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AdminServiceDto {
  return {
    id: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    priceRupiah: service.priceRupiah,
    description: service.description,
    isActive: service.isActive,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}
