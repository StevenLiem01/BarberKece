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
