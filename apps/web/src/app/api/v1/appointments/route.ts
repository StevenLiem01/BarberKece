import { NextRequest, NextResponse } from "next/server";
import {
  GetCustomerAppointmentsUseCase,
  ConfirmBookingUseCase,
  ConfirmBookingInput,
} from "@barberkece/core/reservation";
import {
  PostgresAppointmentRepository,
  PostgresBookingTransactionRunner,
} from "@barberkece/database/repositories";
import { SystemClock } from "@barberkece/core/reservation";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateCustomerApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";
import { ConfirmBookingSchema, toAppointmentDto } from "@barberkece/contracts";

export const runtime = "nodejs";

let getCustomerAppointmentsUseCase: GetCustomerAppointmentsUseCase | undefined;
let confirmBookingUseCase: ConfirmBookingUseCase | undefined;

function getGetCustomerAppointmentsUseCase() {
  if (!getCustomerAppointmentsUseCase) {
    const dbClient = getDatabaseClient();
    const appointmentRepository = new PostgresAppointmentRepository(
      dbClient.db,
    );
    getCustomerAppointmentsUseCase = new GetCustomerAppointmentsUseCase(
      appointmentRepository,
    );
  }
  return getCustomerAppointmentsUseCase;
}

function getConfirmBookingUseCase() {
  if (!confirmBookingUseCase) {
    const dbClient = getDatabaseClient();
    const runner = new PostgresBookingTransactionRunner(dbClient.db);
    const clock = new SystemClock();
    confirmBookingUseCase = new ConfirmBookingUseCase(runner, clock);
  }
  return confirmBookingUseCase;
}

export async function GET() {
  const requestId = generateRequestId();

  try {
    const authResult = await authenticateCustomerApi(requestId);
    if (!authResult.user) {
      return authResult.response;
    }

    const useCase = getGetCustomerAppointmentsUseCase();
    const appointments = await useCase.execute(authResult.user.id);

    return NextResponse.json({
      data: appointments.map(toAppointmentDto),
    });
  } catch (error: unknown) {
    logger.error(
      { requestId, err: error },
      "Failed to get customer appointments",
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

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  try {
    const originValidation = validateSameOrigin(req);
    if (!originValidation.isValid) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: originValidation.message,
            reason: originValidation.reason,
            requestId,
          },
        },
        { status: 403 },
      );
    }

    const authResult = await authenticateCustomerApi(requestId);
    if (!authResult.user) {
      return authResult.response;
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid JSON body",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const parsed = ConfirmBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid request body",
            details: parsed.error.format(),
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;

    const input: ConfirmBookingInput = {
      actorId: authResult.user.id,
      customerId: authResult.user.id,
      serviceId: parsed.data.serviceId,
      startsAt: new Date(parsed.data.startsAt),
      barberProfileId: parsed.data.barberProfileId,
      notes: parsed.data.notes,
      idempotencyKey,
    };

    const useCase = getConfirmBookingUseCase();
    const result = await useCase.execute(input);

    return NextResponse.json(
      { data: toAppointmentDto(result.appointment) },
      { status: 201 },
    );
  } catch (error: unknown) {
    logger.error({ requestId, err: error }, "Failed to confirm booking");

    const errName = error instanceof Error ? error.name : "";
    const errMsg = error instanceof Error ? error.message : "Error";

    // Standard domain error mapping logic (simple version, actual implementation may vary)
    if (
      errName === "ServiceNotFoundError" ||
      errName === "BarberNotEligibleError" ||
      errName === "OutsideBusinessHoursError" ||
      errName === "BarberNotAvailableError" ||
      errName === "SlotAlreadyBookedError" ||
      errName === "CustomerBookingConflictError"
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

    if (
      errName === "IdempotencyPayloadMismatchError" ||
      errName === "IdempotencyConflictError"
    ) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: errMsg,
            requestId,
          },
        },
        { status: 409 },
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
