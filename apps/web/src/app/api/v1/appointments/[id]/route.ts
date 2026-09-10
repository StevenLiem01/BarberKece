import { NextRequest, NextResponse } from "next/server";
import { GetAppointmentUseCase } from "@barberkece/core/reservation";
import { PostgresAppointmentRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateCustomerApi } from "@/lib/auth";
import { toAppointmentDto } from "@barberkece/contracts";

export const runtime = "nodejs";

let getAppointmentUseCase: GetAppointmentUseCase | undefined;

function getUseCase() {
  if (!getAppointmentUseCase) {
    const dbClient = getDatabaseClient();
    const appointmentRepository = new PostgresAppointmentRepository(
      dbClient.db,
    );
    getAppointmentUseCase = new GetAppointmentUseCase(appointmentRepository);
  }
  return getAppointmentUseCase;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();

  try {
    const { id } = await params;
    const authResult = await authenticateCustomerApi(requestId);
    if (!authResult.user) {
      return authResult.response;
    }

    const useCase = getUseCase();
    const appointment = await useCase.execute(id, authResult.user.id);

    return NextResponse.json({
      data: toAppointmentDto(appointment),
    });
  } catch (error: unknown) {
    logger.error({ requestId, err: error }, "Failed to get appointment");

    const errName = error instanceof Error ? error.name : "";

    if (errName === "AppointmentNotFoundError") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Appointment not found",
            requestId,
          },
        },
        { status: 404 },
      );
    }

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
