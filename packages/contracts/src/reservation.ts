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
  barberProfileId: z.string().uuid("Invalid barber profile ID").optional(),
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

export const BarberAppointmentStatusFilterSchema = z.enum([
  "CONFIRMED",
  "CHECKED_IN",
  "IN_SERVICE",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_BARBERSHOP",
  "NO_SHOW",
]);

export const GetBarberAppointmentsQuerySchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
      .optional(),
    from: z.string().datetime("from must be a valid ISO datetime").optional(),
    to: z.string().datetime("to must be a valid ISO datetime").optional(),
    status: z
      .union([
        BarberAppointmentStatusFilterSchema,
        z.array(BarberAppointmentStatusFilterSchema),
      ])
      .optional(),
  })
  .refine(
    (data) => {
      if (data.date && (data.from !== undefined || data.to !== undefined)) {
        return false;
      }
      return true;
    },
    {
      message: "Cannot specify both date and explicit from/to range",
      path: ["date"],
    },
  )
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from).getTime() < new Date(data.to).getTime();
      }
      return true;
    },
    {
      message: "from must be before to",
      path: ["from"],
    },
  );

export type GetBarberAppointmentsQuery = z.infer<
  typeof GetBarberAppointmentsQuerySchema
>;

export const AppointmentIdParamSchema = z
  .string()
  .uuid("Invalid appointment ID");

export const BarberOperationalTargetStatusSchema = z.enum([
  "CHECKED_IN",
  "IN_SERVICE",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED_BY_BARBERSHOP",
]);

export type BarberOperationalTargetStatus = z.infer<
  typeof BarberOperationalTargetStatusSchema
>;

export const TransitionAppointmentStatusSchema = z
  .object({
    targetStatus: BarberOperationalTargetStatusSchema,
    cancellationReason: z
      .string()
      .trim()
      .max(500, "Reason too long")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.targetStatus === "CANCELLED_BY_BARBERSHOP") {
        return (
          typeof data.cancellationReason === "string" &&
          data.cancellationReason.trim().length > 0
        );
      }
      return true;
    },
    {
      message:
        "Cancellation reason is required when barbershop cancels an appointment",
      path: ["cancellationReason"],
    },
  );

export type TransitionAppointmentStatusRequest = z.infer<
  typeof TransitionAppointmentStatusSchema
>;

export interface BarberAppointmentDto {
  id: string;
  bookingReference: string;
  customerId: string;
  barberProfileId: string;
  serviceId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  serviceDurationMinutes: number;
  priceRupiah: number;
  notes: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toBarberAppointmentDto(appointment: {
  id: string;
  bookingReference: string;
  customerId: string;
  barberProfileId: string;
  serviceId: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  serviceDurationMinutes: number;
  priceRupiah: number;
  notes: string | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): BarberAppointmentDto {
  return {
    id: appointment.id,
    bookingReference: appointment.bookingReference,
    customerId: appointment.customerId,
    barberProfileId: appointment.barberProfileId,
    serviceId: appointment.serviceId,
    status: appointment.status,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    serviceDurationMinutes: appointment.serviceDurationMinutes,
    priceRupiah: appointment.priceRupiah,
    notes: appointment.notes,
    cancellationReason: appointment.cancellationReason,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}
