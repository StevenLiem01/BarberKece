import { NextRequest, NextResponse } from "next/server";
import { toPublicServiceDto } from "@barberkece/contracts";
import {
  GetServiceUseCase,
  ServiceNotFoundError,
} from "@barberkece/core/reservation";
import { PostgresServiceRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";

export const runtime = "nodejs";

let serviceRepository: PostgresServiceRepository | undefined;
let getServiceUseCase: GetServiceUseCase | undefined;

function getUseCase() {
  if (!serviceRepository) {
    const dbClient = getDatabaseClient();
    serviceRepository = new PostgresServiceRepository(dbClient.db);
    getServiceUseCase = new GetServiceUseCase(serviceRepository);
  }
  return getServiceUseCase!;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const { id } = await params;

  try {
    const useCase = getUseCase();
    // Public get service: activeOnly = true ensures 404 for inactive service
    const service = await useCase.execute(id, { activeOnly: true });

    return NextResponse.json({
      data: toPublicServiceDto(service),
    });
  } catch (error: unknown) {
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

    logger.error(
      { requestId, err: error, serviceId: id },
      "Public get service failed",
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
