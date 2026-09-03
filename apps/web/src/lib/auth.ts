import { cookies } from "next/headers";
import {
  User,
  ResolveAuthenticatedUserUseCase,
} from "@barberkece/core/identity";
import {
  PostgresUserRepository,
  PostgresSessionRepository,
} from "@barberkece/database/repositories";
import { NodeCryptoTokenAdapter } from "@barberkece/infrastructure/identity";
import { getDatabaseClient } from "@/lib/db";
import { logger } from "@barberkece/infrastructure/logging";

// Ensure Node.js runtime for Server Components and Route Handlers using this helper.
export const runtime = "nodejs";

let resolveAuthenticatedUserUseCase:
  ResolveAuthenticatedUserUseCase | undefined;

function getResolveAuthenticatedUserUseCase(): ResolveAuthenticatedUserUseCase {
  if (!resolveAuthenticatedUserUseCase) {
    const dbClient = getDatabaseClient();
    const userRepository = new PostgresUserRepository(dbClient.db);
    const tokenPort = new NodeCryptoTokenAdapter();
    const sessionRepository = new PostgresSessionRepository(dbClient.db);
    resolveAuthenticatedUserUseCase = new ResolveAuthenticatedUserUseCase(
      userRepository,
      tokenPort,
      sessionRepository,
    );
  }
  return resolveAuthenticatedUserUseCase;
}

/**
 * Resolves the currently authenticated user from the server-side cookies.
 * This function is safe to use in Server Components, Layouts, and Route Handlers.
 *
 * Behavior:
 * - Reads the `barberkece_session` cookie on the server.
 * - Safely returns `null` if the cookie is missing, invalid, or expired.
 * - Rethrows on unexpected infrastructure failures, logging the error.
 * - Never exposes the raw token to the client.
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("barberkece_session");

  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  try {
    const useCase = getResolveAuthenticatedUserUseCase();
    const user = await useCase.execute(sessionCookie.value);

    return user;
  } catch (error: unknown) {
    logger.error(
      { err: error },
      "Unexpected error resolving authenticated user",
    );
    throw error;
  }
}
