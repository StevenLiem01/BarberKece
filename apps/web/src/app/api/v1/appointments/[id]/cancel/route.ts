import { NextRequest, NextResponse } from "next/server";
import {
  CancelAppointmentUseCase,
  CancelAppointmentInput,
  SystemClock,
} from "@barberkece/core/reservation";
import { PostgresBookingTransactionRunner } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateCustomerApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";
import {
  CancelAppointmentSchema,
  toAppointmentDto,
} from "@barberkece/contracts";

export const runtime = "nodejs";

let cancelAppointmentUseCase: CancelAppointmentUseCase | undefined;

function getUseCase() {
  if (!cancelAppointmentUseCase) {
    const dbClient = getDatabaseClient();
    const runner = new PostgresBookingTransactionRunner(dbClient.db);
    const clock = new SystemClock();
    cancelAppointmentUseCase = new CancelAppointmentUseCase(runner, clock);
  }
  return cancelAppointmentUseCase;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();

  try {
    const { id } = await params;
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
      // Body is optional for cancel if no reason is provided
      body = {};
    }

    const parsed = CancelAppointmentSchema.safeParse(body);
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

    const input: CancelAppointmentInput = {
      actorId: authResult.user.id,
      appointmentId: id,
      cancellationReason: parsed.data.reason,
    };

    const useCase = getUseCase();
    const result = await useCase.execute(input);

    return NextResponse.json({
      data: toAppointmentDto(result.appointment),
    });
  } catch (error: unknown) {
    logger.error({ requestId, err: error }, "Failed to cancel appointment");

    const errName = error instanceof Error ? error.name : "";
    const errMsg = error instanceof Error ? error.message : "Error";

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

    if (
      errName === "InvalidAppointmentStatusTransitionError" ||
      errName === "CancellationCutoffExceededError"
    ) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: errMsg, requestId } },
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
