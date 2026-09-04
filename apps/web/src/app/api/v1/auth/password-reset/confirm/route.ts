import { NextRequest, NextResponse } from "next/server";
import { ConfirmPasswordResetSchema } from "@barberkece/contracts";
import { ResetPasswordUseCase, IdentityError } from "@barberkece/core/identity";
import { PostgresPasswordResetTransactionRunner } from "@barberkece/database/repositories";
import {
  Argon2PasswordHashingAdapter,
  NodeCryptoTokenAdapter,
} from "@barberkece/infrastructure/identity";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let resetPasswordUseCase: ResetPasswordUseCase | undefined;

function getResetPasswordUseCase(): ResetPasswordUseCase {
  if (!resetPasswordUseCase) {
    const dbClient = getDatabaseClient();
    const transactionRunner = new PostgresPasswordResetTransactionRunner(
      dbClient.db,
    );
    const passwordHashing = new Argon2PasswordHashingAdapter();
    const tokenPort = new NodeCryptoTokenAdapter();

    resetPasswordUseCase = new ResetPasswordUseCase(
      transactionRunner,
      passwordHashing,
      tokenPort,
    );
  }
  return resetPasswordUseCase;
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  // Origin / Referer CSRF defense for state-changing password reset confirmation
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
        "Forbidden cross-origin password reset confirm request",
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

    const parsed = ConfirmPasswordResetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid password reset confirmation data",
            requestId,
            details: parsed.error.format(),
          },
        },
        { status: 400 },
      );
    }

    const useCase = getResetPasswordUseCase();
    const result = await useCase.execute({
      token: parsed.data.token,
      newPassword: parsed.data.newPassword,
    });

    // Do NOT create login session or Set-Cookie after reset. User must log in again.
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof IdentityError) {
      logger.warn(
        { requestId, err: error.message },
        "Password reset confirmation rejected",
      );
      return NextResponse.json(
        {
          error: {
            code: "INVALID_RESET_TOKEN",
            message: "Invalid or expired password reset token",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    logger.error(
      { requestId, err: error },
      "Unexpected error during password reset confirmation",
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
