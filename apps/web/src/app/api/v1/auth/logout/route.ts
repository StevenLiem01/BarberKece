import { NextRequest, NextResponse } from "next/server";
import { RevokeSessionUseCase } from "@barberkece/core/identity";
import { PostgresSessionRepository } from "@barberkece/database/repositories";
import { NodeCryptoTokenAdapter } from "@barberkece/infrastructure/identity";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { parseEnv } from "@barberkece/config";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let revokeSessionUseCase: RevokeSessionUseCase | undefined;

function getRevokeSessionUseCase(): RevokeSessionUseCase {
  if (!revokeSessionUseCase) {
    const dbClient = getDatabaseClient();
    const tokenPort = new NodeCryptoTokenAdapter();
    const sessionRepository = new PostgresSessionRepository(dbClient.db);
    revokeSessionUseCase = new RevokeSessionUseCase(
      tokenPort,
      sessionRepository,
    );
  }
  return revokeSessionUseCase;
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  // Origin / Referer CSRF defense for cookie-authenticated mutation
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
        "Forbidden cross-origin logout request",
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

  const sessionCookie = req.cookies.get("barberkece_session");

  try {
    if (sessionCookie && sessionCookie.value) {
      const useCase = getRevokeSessionUseCase();
      await useCase.execute(sessionCookie.value);
    }

    const env = parseEnv(process.env);
    const isProduction = env.NODE_ENV === "production";

    const response = NextResponse.json(
      { data: { success: true } },
      { status: 200 },
    );

    response.cookies.set({
      name: "barberkece_session",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error: unknown) {
    logger.error({ requestId, err: error }, "Unexpected error during logout");
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
