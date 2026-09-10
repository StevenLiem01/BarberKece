import { NextRequest, NextResponse } from "next/server";
import { GetAvailableSlotsUseCase } from "@barberkece/core/reservation";
import {
  PostgresServiceRepository,
  PostgresBarberProfileRepository,
  PostgresBarberEligibilityRepository,
  PostgresScheduleRepository,
  PostgresAppointmentRepository,
} from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import {
  GetAvailableSlotsQuerySchema,
  PublicAvailableSlotDto,
} from "@barberkece/contracts";

export const runtime = "nodejs";

let getAvailableSlotsUseCase: GetAvailableSlotsUseCase | undefined;

function getUseCase() {
  if (!getAvailableSlotsUseCase) {
    const dbClient = getDatabaseClient();
    const serviceRepository = new PostgresServiceRepository(dbClient.db);
    const barberProfileRepository = new PostgresBarberProfileRepository(
      dbClient.db,
    );
    const barberEligibilityRepository = new PostgresBarberEligibilityRepository(
      dbClient.db,
    );
    const scheduleRepository = new PostgresScheduleRepository(dbClient.db);
    const appointmentRepository = new PostgresAppointmentRepository(
      dbClient.db,
    );

    getAvailableSlotsUseCase = new GetAvailableSlotsUseCase(
      serviceRepository,
      barberProfileRepository,
      barberEligibilityRepository,
      scheduleRepository,
      appointmentRepository,
    );
  }
  return getAvailableSlotsUseCase;
}

export async function GET(req: NextRequest) {
  const requestId = generateRequestId();

  try {
    const searchParams = req.nextUrl.searchParams;
    const query = {
      serviceId: searchParams.get("serviceId"),
      date: searchParams.get("date"),
    };

    const parsed = GetAvailableSlotsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid query parameters",
            details: parsed.error.format(),
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const { serviceId, date } = parsed.data;

    const useCase = getUseCase();
    const result = await useCase.execute({ serviceId, date });

    // M3-05 constraint: Map explicitly to minimal DTO to strip barber details
    const mappedSlots: PublicAvailableSlotDto[] = result.slots.map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    }));

    return NextResponse.json({ data: mappedSlots });
  } catch (error: unknown) {
    logger.error({ requestId, err: error }, "Failed to get available slots");

    const errName = error instanceof Error ? error.name : "";
    const errMsg = error instanceof Error ? error.message : "Error";

    if (errName === "ServiceNotFoundError") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: errMsg,
            requestId,
          },
        },
        { status: 404 },
      );
    }

    if (
      errName === "InactiveServiceError" ||
      errName === "InvalidBookingDateError" ||
      errName === "BookingHorizonExceededError"
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
