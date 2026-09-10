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

export const GetAvailableSlotsQuerySchema = z.object({
  serviceId: z.string().uuid("Invalid service ID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

export type GetAvailableSlotsQuery = z.infer<
  typeof GetAvailableSlotsQuerySchema
>;

export interface PublicAvailableSlotDto {
  startsAt: string;
  endsAt: string;
}

export const ConfirmBookingSchema = z.object({
  serviceId: z.string().uuid("Invalid service ID"),
  startsAt: z.string().datetime("startsAt must be a valid ISO datetime"),
  barberProfileId: z
    .string()
    .uuid("Invalid barber profile ID")
    .optional()
    .nullable(),
  notes: z.string().trim().max(500, "Notes too long").optional(),
});

export type ConfirmBookingRequest = z.infer<typeof ConfirmBookingSchema>;

export const RescheduleAppointmentSchema = z.object({
  newStartsAt: z.string().datetime("newStartsAt must be a valid ISO datetime"),
});

export type RescheduleAppointmentRequest = z.infer<
  typeof RescheduleAppointmentSchema
>;

export const CancelAppointmentSchema = z.object({
  reason: z.string().trim().max(500, "Reason too long").optional(),
});

export type CancelAppointmentRequest = z.infer<typeof CancelAppointmentSchema>;

export interface AppointmentDto {
  id: string;
  bookingReference: string;
  serviceId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  priceRupiah: number;
  createdAt: string;
  updatedAt: string;
}

export function toAppointmentDto(appointment: {
  id: string;
  bookingReference: string;
  serviceId: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  priceRupiah: number;
  createdAt: Date;
  updatedAt: Date;
}): AppointmentDto {
  return {
    id: appointment.id,
    bookingReference: appointment.bookingReference,
    serviceId: appointment.serviceId,
    status: appointment.status,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    priceRupiah: appointment.priceRupiah,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}
