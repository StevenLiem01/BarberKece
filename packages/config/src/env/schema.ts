import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BUSINESS_TIMEZONE: z.string().default("Asia/Jakarta"),
});

export type Env = z.infer<typeof envSchema>;
