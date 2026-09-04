import { NextRequest, NextResponse } from "next/server";
import { RequestPasswordResetSchema } from "@barberkece/contracts";
import { RequestPasswordResetUseCase } from "@barberkece/core/identity";
import {
  PostgresUserRepository,
  PostgresPasswordResetTransactionRunner,
} from "@barberkece/database/repositories";
import { NodeCryptoTokenAdapter } from "@barberkece/infrastructure/identity";
import { ConsoleEmailAdapter } from "@barberkece/infrastructure/email";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { parseEnv } from "@barberkece/config";
import { getDatabaseClient } from "@/lib/db";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let requestPasswordResetUseCase: RequestPasswordResetUseCase | undefined;

function getRequestPasswordResetUseCase(): RequestPasswordResetUseCase {
  if (!requestPasswordResetUseCase) {
    const dbClient = getDatabaseClient();
    const env = parseEnv(process.env);
    const userRepository = new PostgresUserRepository(dbClient.db);
    const transactionRunner = new PostgresPasswordResetTransactionRunner(
      dbClient.db,
    );
    const tokenPort = new NodeCryptoTokenAdapter();
    const emailPort = new ConsoleEmailAdapter();

    requestPasswordResetUseCase = new RequestPasswordResetUseCase(
      userRepository,
      transactionRunner,
      tokenPort,
      emailPort,
      env.APP_URL,
    );
  }
  return requestPasswordResetUseCase;
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  // Origin / Referer CSRF defense for state-changing password reset request
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
        "Forbidden cross-origin password reset request",
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

    const parsed = RequestPasswordResetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid password reset request data",
            requestId,
            details: parsed.error.format(),
          },
        },
        { status: 400 },
      );
    }

    const useCase = getRequestPasswordResetUseCase();
    const result = await useCase.execute({
      email: parsed.data.email,
    });

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error: unknown) {
    logger.error(
      { requestId, err: error },
      "Unexpected error during password reset request",
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
