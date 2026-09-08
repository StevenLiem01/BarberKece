import { NextRequest, NextResponse } from "next/server";
import { CreateServiceSchema, toAdminServiceDto } from "@barberkece/contracts";
import {
  CreateServiceUseCase,
  ListServicesUseCase,
  ReservationError,
} from "@barberkece/core/reservation";
import { PostgresServiceRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateAdminApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";

export const runtime = "nodejs";

let serviceRepository: PostgresServiceRepository | undefined;
let createServiceUseCase: CreateServiceUseCase | undefined;
let listServicesUseCase: ListServicesUseCase | undefined;

function getUseCases() {
  if (!serviceRepository) {
    const dbClient = getDatabaseClient();
    serviceRepository = new PostgresServiceRepository(dbClient.db);
    createServiceUseCase = new CreateServiceUseCase(serviceRepository);
    listServicesUseCase = new ListServicesUseCase(serviceRepository);
  }
  return {
    createServiceUseCase: createServiceUseCase!,
    listServicesUseCase: listServicesUseCase!,
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

    const parseResult = CreateServiceSchema.safeParse(body);
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

    const { createServiceUseCase } = getUseCases();
    const service = await createServiceUseCase.execute(parseResult.data);

    return NextResponse.json(
      {
        data: toAdminServiceDto(service),
      },
      { status: 201 },
    );
  } catch (error: unknown) {
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

    logger.error({ requestId, err: error }, "Admin create service failed");
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
    const { listServicesUseCase } = getUseCases();
    const services = await listServicesUseCase.execute("all");

    return NextResponse.json({
      data: services.map(toAdminServiceDto),
    });
  } catch (error: unknown) {
    logger.error({ requestId, err: error }, "Admin list services failed");
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
