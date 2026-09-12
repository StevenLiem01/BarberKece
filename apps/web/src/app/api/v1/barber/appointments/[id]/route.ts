import { NextRequest, NextResponse } from "next/server";
import { GetBarberAppointmentDetailUseCase } from "@barberkece/core/reservation";
import { PostgresAppointmentRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateBarberApi } from "@/lib/auth";
import {
  toBarberAppointmentDto,
  AppointmentIdParamSchema,
} from "@barberkece/contracts";

export const runtime = "nodejs";

let getBarberAppointmentDetailUseCase:
  GetBarberAppointmentDetailUseCase | undefined;

function getUseCase() {
  if (!getBarberAppointmentDetailUseCase) {
    const dbClient = getDatabaseClient();
    const appointmentRepository = new PostgresAppointmentRepository(
      dbClient.db,
    );
    getBarberAppointmentDetailUseCase = new GetBarberAppointmentDetailUseCase(
      appointmentRepository,
    );
  }
  return getBarberAppointmentDetailUseCase;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();

  try {
    const { id } = await params;

    const idParsed = AppointmentIdParamSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid appointment ID format",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const authResult = await authenticateBarberApi(requestId);
    if (!authResult.user || !authResult.barberProfile) {
      return authResult.response;
    }

    const useCase = getUseCase();
    const result = await useCase.execute({
      appointmentId: idParsed.data,
      barberProfileId: authResult.barberProfile.id,
    });

    return NextResponse.json({
      data: toBarberAppointmentDto(result.appointment),
    });
  } catch (error: unknown) {
    logger.error(
      { requestId, err: error },
      "Failed to get barber appointment detail",
    );

    const errName = error instanceof Error ? error.name : "";

    // IDOR protection: both nonexistent and foreign appointments return 404 NOT_FOUND
    if (
      errName === "AppointmentNotFoundError" ||
      errName === "AppointmentOwnershipError"
    ) {
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
