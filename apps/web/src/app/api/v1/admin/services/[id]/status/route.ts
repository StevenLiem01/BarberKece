import { NextRequest, NextResponse } from "next/server";
import {
  ToggleServiceStatusSchema,
  toAdminServiceDto,
} from "@barberkece/contracts";
import {
  ToggleServiceStatusUseCase,
  ServiceNotFoundError,
} from "@barberkece/core/reservation";
import { PostgresServiceRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateAdminApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let serviceRepository: PostgresServiceRepository | undefined;
let toggleServiceStatusUseCase: ToggleServiceStatusUseCase | undefined;

function getUseCase() {
  if (!serviceRepository) {
    const dbClient = getDatabaseClient();
    serviceRepository = new PostgresServiceRepository(dbClient.db);
    toggleServiceStatusUseCase = new ToggleServiceStatusUseCase(
      serviceRepository,
    );
  }
  return toggleServiceStatusUseCase!;
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

    const parseResult = ToggleServiceStatusSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid status data",
            details: parseResult.error.flatten(),
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const useCase = getUseCase();
    const service = await useCase.execute(id, parseResult.data.isActive);

    return NextResponse.json({
      data: toAdminServiceDto(service),
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
      "Admin toggle service status failed",
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
