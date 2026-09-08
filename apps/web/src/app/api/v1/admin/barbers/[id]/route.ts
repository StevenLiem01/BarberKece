import { NextRequest, NextResponse } from "next/server";
import {
  UpdateBarberProfileSchema,
  toAdminBarberDto,
} from "@barberkece/contracts";
import {
  GetBarberProfileUseCase,
  UpdateBarberProfileUseCase,
  BarberProfileNotFoundError,
  BarberError,
} from "@barberkece/core/barber";
import { PostgresBarberProfileRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateAdminApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let barberRepository: PostgresBarberProfileRepository | undefined;
let getBarberProfileUseCase: GetBarberProfileUseCase | undefined;
let updateBarberProfileUseCase: UpdateBarberProfileUseCase | undefined;

function getUseCases() {
  if (!barberRepository) {
    const dbClient = getDatabaseClient();
    barberRepository = new PostgresBarberProfileRepository(dbClient.db);
    getBarberProfileUseCase = new GetBarberProfileUseCase(barberRepository);
    updateBarberProfileUseCase = new UpdateBarberProfileUseCase(
      barberRepository,
    );
  }
  return {
    getBarberProfileUseCase: getBarberProfileUseCase!,
    updateBarberProfileUseCase: updateBarberProfileUseCase!,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();

  const authResult = await authenticateAdminApi(requestId);
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await params;

  try {
    const { getBarberProfileUseCase } = getUseCases();
    const profile = await getBarberProfileUseCase.execute(id);

    return NextResponse.json({
      data: toAdminBarberDto(profile),
    });
  } catch (error: unknown) {
    if (error instanceof BarberProfileNotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: "BARBER_PROFILE_NOT_FOUND",
            message: error.message,
            requestId,
          },
        },
        { status: 404 },
      );
    }

    logger.error(
      { requestId, err: error, barberId: id },
      "Admin get barber failed",
    );
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
          requestId,
        },
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();

  const sameOriginResult = validateSameOrigin(req);
  if (!sameOriginResult.isValid) {
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

  const authResult = await authenticateAdminApi(requestId);
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await params;

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const parseResult = UpdateBarberProfileSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid barber update data",
            details: parseResult.error.flatten(),
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const { updateBarberProfileUseCase } = getUseCases();
    const profile = await updateBarberProfileUseCase.execute(
      id,
      parseResult.data,
    );

    return NextResponse.json({
      data: toAdminBarberDto(profile),
    });
  } catch (error: unknown) {
    if (error instanceof BarberProfileNotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: "BARBER_PROFILE_NOT_FOUND",
            message: error.message,
            requestId,
          },
        },
        { status: 404 },
      );
    }

    if (error instanceof BarberError) {
      return NextResponse.json(
        {
          error: {
            code: "BARBER_ERROR",
            message: error.message,
            requestId,
          },
        },
        { status: 400 },
      );
    }

    logger.error(
      { requestId, err: error, barberId: id },
      "Admin update barber failed",
    );
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
          requestId,
        },
      },
      { status: 500 },
    );
  }
}
