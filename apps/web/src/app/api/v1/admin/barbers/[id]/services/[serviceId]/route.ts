import { NextRequest, NextResponse } from "next/server";
import {
  RemoveServiceFromBarberUseCase,
  ServiceNotFoundError,
  ReservationError,
} from "@barberkece/core/reservation";
import { BarberProfileNotFoundError } from "@barberkece/core/barber";
import {
  PostgresBarberEligibilityRepository,
  PostgresServiceRepository,
  PostgresBarberProfileRepository,
} from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateAdminApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let barberEligibilityRepository:
  PostgresBarberEligibilityRepository | undefined;
let serviceRepository: PostgresServiceRepository | undefined;
let barberRepository: PostgresBarberProfileRepository | undefined;
let removeServiceUseCase: RemoveServiceFromBarberUseCase | undefined;

function getUseCase() {
  if (!barberEligibilityRepository) {
    const dbClient = getDatabaseClient();
    barberEligibilityRepository = new PostgresBarberEligibilityRepository(
      dbClient.db,
    );
    serviceRepository = new PostgresServiceRepository(dbClient.db);
    barberRepository = new PostgresBarberProfileRepository(dbClient.db);

    removeServiceUseCase = new RemoveServiceFromBarberUseCase(
      barberRepository,
      serviceRepository,
      barberEligibilityRepository,
    );
  }
  return removeServiceUseCase!;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> },
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

  const { id: barberId, serviceId } = await params;

  try {
    const useCase = getUseCase();
    await useCase.execute({
      barberProfileId: barberId,
      serviceId,
    });

    return NextResponse.json({
      data: {
        success: true,
      },
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

    if (error instanceof ServiceNotFoundError) {
      return NextResponse.json(
        {
          error: {
            code: "SERVICE_NOT_FOUND",
            message: error.message,
            requestId,
          },
        },
        { status: 404 },
      );
    }

    if (error instanceof ReservationError) {
      return NextResponse.json(
        {
          error: {
            code: "ELIGIBILITY_ERROR",
            message: error.message,
            requestId,
          },
        },
        { status: 400 },
      );
    }

    logger.error(
      { requestId, err: error, barberId, serviceId },
      "Admin remove service failed",
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
