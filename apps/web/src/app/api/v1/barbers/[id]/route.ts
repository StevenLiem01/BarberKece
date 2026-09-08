import { NextRequest, NextResponse } from "next/server";
import { toPublicBarberDto } from "@barberkece/contracts";
import {
  GetBarberProfileUseCase,
  BarberProfileNotFoundError,
} from "@barberkece/core/barber";
import { PostgresBarberProfileRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";

export const runtime = "nodejs";

let barberRepository: PostgresBarberProfileRepository | undefined;
let getBarberProfileUseCase: GetBarberProfileUseCase | undefined;

function getUseCase() {
  if (!barberRepository) {
    const dbClient = getDatabaseClient();
    barberRepository = new PostgresBarberProfileRepository(dbClient.db);
    getBarberProfileUseCase = new GetBarberProfileUseCase(barberRepository);
  }
  return getBarberProfileUseCase!;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const { id } = await params;

  try {
    const useCase = getUseCase();
    const profile = await useCase.execute(id);

    return NextResponse.json({
      data: toPublicBarberDto(profile),
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
      "Public get barber failed",
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
