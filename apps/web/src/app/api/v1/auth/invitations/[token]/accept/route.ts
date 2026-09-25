import { NextRequest, NextResponse } from "next/server";
import { AcceptStaffInvitationSchema } from "@barberkece/contracts";
import {
  AcceptStaffInvitationUseCase,
  InvalidStaffInvitationError,
  StaffInvitationExpiredError,
  StaffInvitationAlreadyUsedError,
  UserAlreadyExistsError,
  IdentityError,
} from "@barberkece/core/identity";
import { PostgresStaffInvitationTransactionRunner } from "@barberkece/database/repositories";
import {
  Argon2PasswordHashingAdapter,
  NodeCryptoTokenAdapter,
} from "@barberkece/infrastructure/identity";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let acceptStaffInvitationUseCase: AcceptStaffInvitationUseCase | undefined;

function getAcceptStaffInvitationUseCase(): AcceptStaffInvitationUseCase {
  if (!acceptStaffInvitationUseCase) {
    const dbClient = getDatabaseClient();
    const transactionRunner = new PostgresStaffInvitationTransactionRunner(
      dbClient.db,
    );
    const passwordHashing = new Argon2PasswordHashingAdapter();
    const tokenPort = new NodeCryptoTokenAdapter();

    acceptStaffInvitationUseCase = new AcceptStaffInvitationUseCase(
      transactionRunner,
      passwordHashing,
      tokenPort,
    );
  }
  return acceptStaffInvitationUseCase;
}

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();
  const { token } = await params;

  // Origin / Referer CSRF defense for state-changing invitation acceptance
  const sameOriginResult = validateSameOrigin(req);
  if (!sameOriginResult.isValid) {
    logger.warn(
      {
        requestId,
        origin: req.headers.get("origin"),
        referer: req.headers.get("referer"),
        host: req.headers.get("host") ?? req.nextUrl.host,
      },
      "Forbidden cross-origin staff invitation accept request",
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

  if (!token || token.trim() === "") {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INVITATION_TOKEN",
          message: "Token undangan tidak valid",
          requestId,
        },
      },
      { status: 400 },
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

    const parseResult = AcceptStaffInvitationSchema.safeParse({
      token,
      password: body?.password,
    });
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Password minimal 8 karakter",
            details: parseResult.error.flatten(),
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const useCase = getAcceptStaffInvitationUseCase();
    const result = await useCase.execute({
      token: parseResult.data.token,
      passwordRaw: parseResult.data.password,
    });

    return NextResponse.json(
      {
        data: {
          message: "Akun berhasil dibuat. Silakan masuk.",
          email: result.user.email,
          role: result.user.role,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof InvalidStaffInvitationError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INVITATION_TOKEN",
            message: error.message,
            requestId,
          },
        },
        { status: 404 },
      );
    }

    if (error instanceof StaffInvitationExpiredError) {
      return NextResponse.json(
        {
          error: {
            code: "INVITATION_EXPIRED",
            message: error.message,
            requestId,
          },
        },
        { status: 410 },
      );
    }

    if (error instanceof StaffInvitationAlreadyUsedError) {
      return NextResponse.json(
        {
          error: {
            code: "INVITATION_ALREADY_USED",
            message: error.message,
            requestId,
          },
        },
        { status: 400 },
      );
    }

    if (error instanceof UserAlreadyExistsError) {
      return NextResponse.json(
        {
          error: {
            code: "USER_ALREADY_EXISTS",
            message: error.message,
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
            code: "IDENTITY_ERROR",
            message: error.message,
            requestId,
          },
        },
        { status: 400 },
      );
    }

    logger.error(
      { requestId, err: error },
      "Unexpected error during staff invitation acceptance",
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
