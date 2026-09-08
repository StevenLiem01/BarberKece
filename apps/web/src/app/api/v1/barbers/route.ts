import { NextResponse } from "next/server";
import { toPublicBarberDto } from "@barberkece/contracts";
import { ListBarbersUseCase } from "@barberkece/core/barber";
import { PostgresBarberProfileRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";

export const runtime = "nodejs";

let barberRepository: PostgresBarberProfileRepository | undefined;
let listBarbersUseCase: ListBarbersUseCase | undefined;

function getUseCase() {
  if (!barberRepository) {
    const dbClient = getDatabaseClient();
    barberRepository = new PostgresBarberProfileRepository(dbClient.db);
    listBarbersUseCase = new ListBarbersUseCase(barberRepository);
  }
  return listBarbersUseCase!;
}

export async function GET() {
  const requestId = generateRequestId();

  try {
    const useCase = getUseCase();
    const barbers = await useCase.execute();

    return NextResponse.json({
      data: barbers.map(toPublicBarberDto),
    });
  } catch (error: unknown) {
    logger.error({ requestId, err: error }, "Public list barbers failed");
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
