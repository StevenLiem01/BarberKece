import { NextRequest, NextResponse } from "next/server";
import {
  AssignServiceToBarberSchema,
  toAdminServiceDto,
} from "@barberkece/contracts";
import {
  AssignServiceToBarberUseCase,
  GetBarberEligibleServicesUseCase,
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
let assignServiceUseCase: AssignServiceToBarberUseCase | undefined;
let getEligibleServicesUseCase: GetBarberEligibleServicesUseCase | undefined;

function getUseCases() {
  if (!barberEligibilityRepository) {
    const dbClient = getDatabaseClient();
    barberEligibilityRepository = new PostgresBarberEligibilityRepository(
      dbClient.db,
    );
    serviceRepository = new PostgresServiceRepository(dbClient.db);
    barberRepository = new PostgresBarberProfileRepository(dbClient.db);

    assignServiceUseCase = new AssignServiceToBarberUseCase(
      barberRepository,
      serviceRepository,
      barberEligibilityRepository,
    );
    getEligibleServicesUseCase = new GetBarberEligibleServicesUseCase(
      barberRepository,
      barberEligibilityRepository,
    );
  }
  return {
    assignServiceUseCase: assignServiceUseCase!,
    getEligibleServicesUseCase: getEligibleServicesUseCase!,
  };
}

export async function POST(
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

  const { id: barberId } = await params;

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

    const parseResult = AssignServiceToBarberSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid assignment data",
            details: parseResult.error.flatten(),
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const { assignServiceUseCase } = getUseCases();
    await assignServiceUseCase.execute({
      barberProfileId: barberId,
      serviceId: parseResult.data.serviceId,
    });

    return NextResponse.json({
      data: {
        barberId,
        serviceId: parseResult.data.serviceId,
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
      { requestId, err: error, barberId },
      "Admin assign service failed",
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();

  const authResult = await authenticateAdminApi(requestId);
  if (authResult.response) {
    return authResult.response;
  }

  const { id: barberId } = await params;

  try {
    const { getEligibleServicesUseCase } = getUseCases();
    const services = await getEligibleServicesUseCase.execute({
      barberProfileId: barberId,
      activeOnly: false,
    });

    return NextResponse.json({
      data: services.map(toAdminServiceDto),
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
      "Admin get eligible services failed",
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
