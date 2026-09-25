import { NextRequest, NextResponse } from "next/server";
import {
  ProvisionBarberProfileSchema,
  toAdminBarberDto,
} from "@barberkece/contracts";
import {
  ProvisionBarberProfileUseCase,
  ListBarbersUseCase,
  BarberUserNotFoundError,
  InvalidBarberRoleError,
  BarberProfileAlreadyExistsError,
  BarberError,
} from "@barberkece/core/barber";
import {
  PostgresBarberProfileRepository,
  PostgresUserRepository,
} from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateAdminApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let barberRepository: PostgresBarberProfileRepository | undefined;
let userRepository: PostgresUserRepository | undefined;
let provisionBarberProfileUseCase: ProvisionBarberProfileUseCase | undefined;
let listBarbersUseCase: ListBarbersUseCase | undefined;

function getUseCases() {
  if (!barberRepository) {
    const dbClient = getDatabaseClient();
    barberRepository = new PostgresBarberProfileRepository(dbClient.db);
    userRepository = new PostgresUserRepository(dbClient.db);
    provisionBarberProfileUseCase = new ProvisionBarberProfileUseCase(
      barberRepository,
      userRepository,
    );
    listBarbersUseCase = new ListBarbersUseCase(barberRepository);
  }
  return {
    provisionBarberProfileUseCase: provisionBarberProfileUseCase!,
    listBarbersUseCase: listBarbersUseCase!,
  };
}

export async function POST(req: NextRequest) {
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

    const parseResult = ProvisionBarberProfileSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid barber profile data",
            details: parseResult.error.flatten(),
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const { provisionBarberProfileUseCase } = getUseCases();
    const profile = await provisionBarberProfileUseCase.execute(
      parseResult.data,
    );

    return NextResponse.json(
      {
        data: toAdminBarberDto(profile),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof BarberUserNotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: "USER_NOT_FOUND",
            message: error.message,
            requestId,
          },
        },
        { status: 404 },
      );
    }

    if (error instanceof InvalidBarberRoleError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_BARBER_ROLE",
            message: error.message,
            requestId,
          },
        },
        { status: 400 },
      );
    }

    if (error instanceof BarberProfileAlreadyExistsError) {
      return NextResponse.json(
        {
          error: {
            code: "BARBER_PROFILE_ALREADY_EXISTS",
            message: error.message,
            requestId,
          },
        },
        { status: 409 },
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
      { requestId, err: error },
      "Admin provision barber profile failed",
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

export async function GET() {
  const requestId = generateRequestId();

  const authResult = await authenticateAdminApi(requestId);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const { listBarbersUseCase } = getUseCases();
    const barbers = await listBarbersUseCase.execute({ includeUnnamed: true });

    return NextResponse.json({
      data: barbers.map(toAdminBarberDto),
    });
  } catch (error: unknown) {
    logger.error({ requestId, err: error }, "Admin list barbers failed");
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
