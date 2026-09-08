import { NextRequest, NextResponse } from "next/server";
import { UpdateServiceSchema, toAdminServiceDto } from "@barberkece/contracts";
import {
  GetServiceUseCase,
  UpdateServiceUseCase,
  ServiceNotFoundError,
  ReservationError,
} from "@barberkece/core/reservation";
import { PostgresServiceRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateAdminApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let serviceRepository: PostgresServiceRepository | undefined;
let getServiceUseCase: GetServiceUseCase | undefined;
let updateServiceUseCase: UpdateServiceUseCase | undefined;

function getUseCases() {
  if (!serviceRepository) {
    const dbClient = getDatabaseClient();
    serviceRepository = new PostgresServiceRepository(dbClient.db);
    getServiceUseCase = new GetServiceUseCase(serviceRepository);
    updateServiceUseCase = new UpdateServiceUseCase(serviceRepository);
  }
  return {
    getServiceUseCase: getServiceUseCase!,
    updateServiceUseCase: updateServiceUseCase!,
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
    const { getServiceUseCase } = getUseCases();
    const service = await getServiceUseCase.execute(id, { activeOnly: false });

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
      "Admin get service failed",
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

    const parseResult = UpdateServiceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid service data",
            details: parseResult.error.flatten(),
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const { updateServiceUseCase } = getUseCases();
    const service = await updateServiceUseCase.execute(id, parseResult.data);

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

    if (error instanceof ReservationError) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: error.message,
            requestId,
          },
        },
        { status: 400 },
      );
    }

    logger.error(
      { requestId, err: error, serviceId: id },
      "Admin update service failed",
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
