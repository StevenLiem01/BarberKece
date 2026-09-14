import { z } from "zod";

export const RegisterCustomerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export type RegisterCustomerRequest = z.infer<typeof RegisterCustomerSchema>;

export const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof LoginSchema>;

export const RequestPasswordResetSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export type RequestPasswordResetRequest = z.infer<
  typeof RequestPasswordResetSchema
>;

export const ConfirmPasswordResetSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters long"),
});

export type ConfirmPasswordResetRequest = z.infer<
  typeof ConfirmPasswordResetSchema
>;

import {
  FACE_SHAPES,
  HAIR_TYPES,
  HAIR_DENSITIES,
  HAIR_LENGTHS,
  MAINTENANCE_LEVELS,
} from "@barberkece/core/recommendation";

export const FaceShapeEnum = z.enum(FACE_SHAPES);
export const HairTypeEnum = z.enum(HAIR_TYPES);
export const HairDensityEnum = z.enum(HAIR_DENSITIES);
export const HairLengthEnum = z.enum(HAIR_LENGTHS);
export const MaintenanceLevelEnum = z.enum(MAINTENANCE_LEVELS);

export const SaveHairProfileSchema = z.object({
  faceShape: FaceShapeEnum.nullable().optional(),
  hairType: HairTypeEnum.nullable().optional(),
  hairDensity: HairDensityEnum.nullable().optional(),
  hairLength: HairLengthEnum.nullable().optional(),
  maintenance: MaintenanceLevelEnum.nullable().optional(),
  styleTags: z.array(z.string().trim().min(1).max(50)).nullable().optional(),
});

export type SaveHairProfileRequest = z.infer<typeof SaveHairProfileSchema>;
