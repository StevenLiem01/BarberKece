import { NextRequest, NextResponse } from "next/server";
import { ValidateStaffInvitationUseCase } from "@barberkece/core/identity";
import {
  PostgresStaffInvitationRepository,
  PostgresUserRepository,
} from "@barberkece/database/repositories";
import { NodeCryptoTokenAdapter } from "@barberkece/infrastructure/identity";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";

export const runtime = "nodejs";

let validateStaffInvitationUseCase: ValidateStaffInvitationUseCase | undefined;

function getValidateStaffInvitationUseCase(): ValidateStaffInvitationUseCase {
  if (!validateStaffInvitationUseCase) {
    const dbClient = getDatabaseClient();
    const staffInvitationRepository = new PostgresStaffInvitationRepository(
      dbClient.db,
    );
    const userRepository = new PostgresUserRepository(dbClient.db);
    const tokenPort = new NodeCryptoTokenAdapter();

    validateStaffInvitationUseCase = new ValidateStaffInvitationUseCase(
      staffInvitationRepository,
      tokenPort,
      userRepository,
    );
  }
  return validateStaffInvitationUseCase;
}

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();
  const { token } = await params;

  if (!token || token.trim() === "") {
    return NextResponse.json(
      {
        error: {
          code: "INVITATION_NOT_FOUND",
          message: "Undangan tidak ditemukan atau token tidak valid",
          requestId,
        },
      },
      { status: 404 },
    );
  }

  try {
    const useCase = getValidateStaffInvitationUseCase();
    const result = await useCase.execute({ token });

    if (!result.isValid) {
      if (result.reason === "EXPIRED") {
        return NextResponse.json(
          {
            error: {
              code: "INVITATION_EXPIRED",
              message:
                "Tautan undangan telah kedaluwarsa. Silakan hubungi admin untuk mendapatkan undangan baru.",
              requestId,
            },
            data: {
              email: result.email,
              displayName: result.displayName,
              role: result.role,
              isValid: false,
              reason: "EXPIRED",
            },
          },
          { status: 410 },
        );
      }

      if (result.reason === "USED") {
        return NextResponse.json(
          {
            error: {
              code: "INVITATION_ALREADY_USED",
              message: "Tautan undangan ini sudah pernah digunakan.",
              requestId,
            },
            data: {
              email: result.email,
              displayName: result.displayName,
              role: result.role,
              isValid: false,
              reason: "USED",
            },
          },
          { status: 400 },
        );
      }

      if (result.reason === "USER_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            error: {
              code: "USER_ALREADY_EXISTS",
              message: "Akun untuk email ini sudah aktif.",
              requestId,
            },
            data: {
              email: result.email,
              displayName: result.displayName,
              role: result.role,
              isValid: false,
              reason: "USER_ALREADY_EXISTS",
            },
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error: {
            code: "INVITATION_NOT_FOUND",
            message: "Undangan tidak ditemukan atau token tidak valid",
            requestId,
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        data: {
          email: result.email,
          displayName: result.displayName,
          role: result.role,
          isValid: true,
        },
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    logger.error(
      { requestId, err: error },
      "Unexpected error during staff invitation validation",
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
