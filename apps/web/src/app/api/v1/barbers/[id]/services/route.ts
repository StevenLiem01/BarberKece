import { NextRequest, NextResponse } from "next/server";
import { toPublicServiceDto } from "@barberkece/contracts";
import { GetBarberEligibleServicesUseCase } from "@barberkece/core/reservation";
import { BarberProfileNotFoundError } from "@barberkece/core/barber";
import {
  PostgresBarberEligibilityRepository,
  PostgresBarberProfileRepository,
} from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";

export const runtime = "nodejs";

let barberEligibilityRepository:
  PostgresBarberEligibilityRepository | undefined;
let barberRepository: PostgresBarberProfileRepository | undefined;
let getEligibleServicesUseCase: GetBarberEligibleServicesUseCase | undefined;

function getUseCase() {
  if (!barberEligibilityRepository) {
    const dbClient = getDatabaseClient();
    barberEligibilityRepository = new PostgresBarberEligibilityRepository(
      dbClient.db,
    );
    barberRepository = new PostgresBarberProfileRepository(dbClient.db);
    getEligibleServicesUseCase = new GetBarberEligibleServicesUseCase(
      barberRepository,
      barberEligibilityRepository,
    );
  }
  return getEligibleServicesUseCase!;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const { id: barberId } = await params;

  try {
    const useCase = getUseCase();
    // Public mode: activeOnly = true ensures only active eligible services are returned
    const services = await useCase.execute({
      barberProfileId: barberId,
      activeOnly: true,
    });

    return NextResponse.json({
      data: services.map(toPublicServiceDto),
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
      { requestId, err: error, barberId },
      "Public get barber eligible services failed",
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
