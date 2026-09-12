import { NextRequest, NextResponse } from "next/server";
import {
  GetBarberAppointmentsUseCase,
  GetBarberAppointmentsInput,
  AppointmentStatus,
} from "@barberkece/core/reservation";
import { PostgresAppointmentRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateBarberApi } from "@/lib/auth";
import {
  GetBarberAppointmentsQuerySchema,
  toBarberAppointmentDto,
} from "@barberkece/contracts";

export const runtime = "nodejs";

let getBarberAppointmentsUseCase: GetBarberAppointmentsUseCase | undefined;

function getUseCase() {
  if (!getBarberAppointmentsUseCase) {
    const dbClient = getDatabaseClient();
    const appointmentRepository = new PostgresAppointmentRepository(
      dbClient.db,
    );
    getBarberAppointmentsUseCase = new GetBarberAppointmentsUseCase(
      appointmentRepository,
    );
  }
  return getBarberAppointmentsUseCase;
}

export async function GET(req: NextRequest) {
  const requestId = generateRequestId();

  try {
    const authResult = await authenticateBarberApi(requestId);
    if (!authResult.user || !authResult.barberProfile) {
      return authResult.response;
    }

    const searchParams = req.nextUrl.searchParams;
    const date = searchParams.get("date") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const rawStatuses = searchParams.getAll("status");
    let status: string | string[] | undefined = undefined;
    if (rawStatuses.length === 1) {
      const single = rawStatuses[0]!;
      if (single.includes(",")) {
        status = single.split(",").map((s) => s.trim());
      } else if (single.trim()) {
        status = single.trim();
      }
    } else if (rawStatuses.length > 1) {
      status = rawStatuses.flatMap((s) => s.split(",")).map((s) => s.trim());
    }

    const parsed = GetBarberAppointmentsQuerySchema.safeParse({
      date,
      from,
      to,
      status,
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const message =
        firstIssue && firstIssue.message !== "Invalid input"
          ? firstIssue.message
          : "Invalid query parameters";
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message,
            details: parsed.error.format(),
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const input: GetBarberAppointmentsInput = {
      barberProfileId: authResult.barberProfile.id,
      date: parsed.data.date,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
      status: parsed.data.status as
        AppointmentStatus | AppointmentStatus[] | undefined,
    };

    const useCase = getUseCase();
    const result = await useCase.execute(input);

    return NextResponse.json({
      data: result.appointments.map(toBarberAppointmentDto),
    });
  } catch (error: unknown) {
    logger.error(
      { requestId, err: error },
      "Failed to get barber appointments",
    );

    const errName = error instanceof Error ? error.name : "";
    const errMsg = error instanceof Error ? error.message : "Error";

    if (
      errName === "InvalidBookingDateError" ||
      errMsg === "Cannot specify both date and explicit from/to range" ||
      errMsg === "from must be before to"
    ) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: errMsg,
            requestId,
          },
        },
        { status: 400 },
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
