import { NextRequest, NextResponse } from "next/server";
import { LoginSchema } from "@barberkece/contracts";
import {
  AuthenticateUserUseCase,
  IdentityError,
  AuthenticationError,
} from "@barberkece/core/identity";
import {
  PostgresUserRepository,
  PostgresSessionRepository,
} from "@barberkece/database/repositories";
import {
  Argon2PasswordHashingAdapter,
  NodeCryptoTokenAdapter,
} from "@barberkece/infrastructure/identity";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { parseEnv } from "@barberkece/config";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let authenticateUserUseCase: AuthenticateUserUseCase | undefined;

function getAuthenticateUserUseCase(): AuthenticateUserUseCase {
  if (!authenticateUserUseCase) {
    const dbClient = getDatabaseClient();
    const userRepository = new PostgresUserRepository(dbClient.db);
    const passwordHashing = new Argon2PasswordHashingAdapter();
    const tokenPort = new NodeCryptoTokenAdapter();
    const sessionRepository = new PostgresSessionRepository(dbClient.db);
    authenticateUserUseCase = new AuthenticateUserUseCase(
      userRepository,
      passwordHashing,
      tokenPort,
      sessionRepository,
    );
  }
  return authenticateUserUseCase;
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  // Origin / Referer CSRF defense for state-changing authentication mutation
  const sameOriginResult = validateSameOrigin(req);
  if (!sameOriginResult.isValid) {
    if (
      sameOriginResult.reason === "mismatched_origin" ||
      sameOriginResult.reason === "mismatched_referer" ||
      sameOriginResult.reason === "missing_origin"
    ) {
      logger.warn(
        {
          requestId,
          origin: req.headers.get("origin"),
          referer: req.headers.get("referer"),
          host: req.headers.get("host") ?? req.nextUrl.host,
        },
        "Forbidden cross-origin login request",
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: sameOriginResult.message,
          requestId,
        },
      },
      { status: 403 },
    );
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "MALFORMED_JSON",
            message: "Request body must be valid JSON",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid login data",
            requestId,
            details: parsed.error.format(),
          },
        },
        { status: 400 },
      );
    }

    const useCase = getAuthenticateUserUseCase();
    const result = await useCase.execute({
      email: parsed.data.email,
      passwordRaw: parsed.data.password,
    });

    // Enforce Secure flag conditionally based on env
    const env = parseEnv(process.env);
    const isProduction = env.NODE_ENV === "production";

    const response = NextResponse.json({ data: result.user }, { status: 200 });

    response.cookies.set({
      name: "barberkece_session",
      value: result.rawToken,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: 604800, // 7 days in seconds
      expires: result.expiresAt,
    });

    return response;
  } catch (error: unknown) {
    // Both AuthenticationError and generic IdentityError should be mapped to the
    // same generic response to prevent enumeration.
    if (
      error instanceof AuthenticationError ||
      error instanceof IdentityError
    ) {
      logger.warn({ requestId, err: error.message }, "Authentication failed");
      return NextResponse.json(
        {
          error: {
            code: "AUTHENTICATION_FAILED",
            message: "Invalid email or password",
            requestId,
          },
        },
        { status: 401 },
      );
    }

    logger.error(
      { requestId, err: error },
      "Unexpected error during authentication",
    );
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred",
          requestId,
        },
      },
      { status: 500 },
    );
  }
}
