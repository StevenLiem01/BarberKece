import { NextRequest, NextResponse } from "next/server";
import { RevokeSessionUseCase } from "@barberkece/core/identity";
import { PostgresSessionRepository } from "@barberkece/database/repositories";
import { NodeCryptoTokenAdapter } from "@barberkece/infrastructure/identity";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { parseEnv } from "@barberkece/config";

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
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host") ?? req.nextUrl.host;

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        logger.warn(
          { requestId, origin, host },
          "Forbidden cross-origin logout request",
        );
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "Cross-origin request forbidden",
              requestId,
            },
          },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Invalid origin header",
            requestId,
          },
        },
        { status: 403 },
      );
    }
  } else if (referer && host) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost !== host) {
        logger.warn(
          { requestId, referer, host },
          "Forbidden cross-origin logout request",
        );
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN",
              message: "Cross-origin request forbidden",
              requestId,
            },
          },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Invalid referer header",
            requestId,
          },
        },
        { status: 403 },
      );
    }
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
