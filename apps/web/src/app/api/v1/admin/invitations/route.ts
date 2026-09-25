import { NextRequest, NextResponse } from "next/server";
import { CreateStaffInvitationSchema } from "@barberkece/contracts";
import {
  CreateStaffInvitationUseCase,
  UserAlreadyExistsError,
  IdentityError,
} from "@barberkece/core/identity";
import { PostgresStaffInvitationTransactionRunner } from "@barberkece/database/repositories";
import { NodeCryptoTokenAdapter } from "@barberkece/infrastructure/identity";
import { ConsoleEmailAdapter } from "@barberkece/infrastructure/email";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { parseEnv } from "@barberkece/config";
import { getDatabaseClient } from "@/lib/db";
import { authenticateAdminApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let createStaffInvitationUseCase: CreateStaffInvitationUseCase | undefined;

function getCreateStaffInvitationUseCase(): CreateStaffInvitationUseCase {
  if (!createStaffInvitationUseCase) {
    const dbClient = getDatabaseClient();
    const env = parseEnv(process.env);
    const transactionRunner = new PostgresStaffInvitationTransactionRunner(
      dbClient.db,
    );
    const tokenPort = new NodeCryptoTokenAdapter();
    const emailPort = new ConsoleEmailAdapter();

    createStaffInvitationUseCase = new CreateStaffInvitationUseCase(
      transactionRunner,
      tokenPort,
      emailPort,
      env.APP_URL,
    );
  }
  return createStaffInvitationUseCase;
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  // Origin / Referer CSRF defense for state-changing admin action
  const sameOriginResult = validateSameOrigin(req);
  if (!sameOriginResult.isValid) {
    logger.warn(
      {
        requestId,
        origin: req.headers.get("origin"),
        referer: req.headers.get("referer"),
        host: req.headers.get("host") ?? req.nextUrl.host,
      },
      "Forbidden cross-origin staff invitation creation request",
    );
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

  // Admin authorization check
  const authResult = await authenticateAdminApi(requestId);
  if (authResult.response) {
    return authResult.response;
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

    const parsed = CreateStaffInvitationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Data undangan staf tidak valid",
            requestId,
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const useCase = getCreateStaffInvitationUseCase();
    const invitation = await useCase.execute({
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      role: parsed.data.role,
    });

    return NextResponse.json(
      {
        data: {
          id: invitation.id,
          email: invitation.email,
          displayName: invitation.displayName,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof UserAlreadyExistsError) {
      return NextResponse.json(
        {
          error: {
            code: "USER_ALREADY_EXISTS",
            message: "Pengguna dengan email ini sudah terdaftar",
            requestId,
          },
        },
        { status: 409 },
      );
    }

    if (error instanceof IdentityError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INVITATION_DATA",
            message: error.message,
            requestId,
          },
        },
        { status: 400 },
      );
    }

    logger.error(
      { requestId, err: error },
      "Unexpected error during staff invitation creation",
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
