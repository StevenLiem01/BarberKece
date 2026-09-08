import { NextResponse } from "next/server";
import { toPublicServiceDto } from "@barberkece/contracts";
import { ListServicesUseCase } from "@barberkece/core/reservation";
import { PostgresServiceRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";

export const runtime = "nodejs";

let serviceRepository: PostgresServiceRepository | undefined;
let listServicesUseCase: ListServicesUseCase | undefined;

function getUseCase() {
  if (!serviceRepository) {
    const dbClient = getDatabaseClient();
    serviceRepository = new PostgresServiceRepository(dbClient.db);
    listServicesUseCase = new ListServicesUseCase(serviceRepository);
  }
  return listServicesUseCase!;
}

export async function GET() {
  const requestId = generateRequestId();

  try {
    const useCase = getUseCase();
    const services = await useCase.execute("active");

    return NextResponse.json({
      data: services.map(toPublicServiceDto),
    });
  } catch (error: unknown) {
    logger.error({ requestId, err: error }, "Public list services failed");
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
