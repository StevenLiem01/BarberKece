import { envSchema, type Env } from "./schema.js";

export type ParseEnvResult =
  | { success: true; data: Env }
  | {
      success: false;
      error: Error;
      details: Record<string, string[] | undefined>;
    };

export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const errorMessages = result.error.issues.map(
      (issue) => `[${issue.path.join(".") || "root"}]: ${issue.message}`,
    );
    throw new Error(
      `Invalid environment configuration:\n  ${errorMessages.join("\n  ")}`,
    );
  }

  return result.data;
}

export function safeParseEnv(
  input: Record<string, string | undefined>,
): ParseEnvResult {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const details = result.error.flatten().fieldErrors;
    const errorMessages = result.error.issues.map(
      (issue) => `[${issue.path.join(".") || "root"}]: ${issue.message}`,
    );
    return {
      success: false,
      error: new Error(
        `Invalid environment configuration:\n  ${errorMessages.join("\n  ")}`,
      ),
      details,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
