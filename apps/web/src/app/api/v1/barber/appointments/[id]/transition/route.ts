import { NextRequest, NextResponse } from "next/server";
import {
  TransitionAppointmentStatusUseCase,
  TransitionAppointmentStatusInput,
  AppointmentStatus,
  SystemClock,
} from "@barberkece/core/reservation";
import { PostgresBookingTransactionRunner } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateBarberApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";
import {
  TransitionAppointmentStatusSchema,
  toBarberAppointmentDto,
  AppointmentIdParamSchema,
} from "@barberkece/contracts";

export const runtime = "nodejs";

let transitionAppointmentStatusUseCase:
  TransitionAppointmentStatusUseCase | undefined;

function getUseCase() {
  if (!transitionAppointmentStatusUseCase) {
    const dbClient = getDatabaseClient();
    const runner = new PostgresBookingTransactionRunner(dbClient.db);
    const clock = new SystemClock();
    transitionAppointmentStatusUseCase = new TransitionAppointmentStatusUseCase(
      runner,
      clock,
    );
  }
  return transitionAppointmentStatusUseCase;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();

  try {
    // 1. Same-origin CSRF validation for state-changing mutation
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

    // 2. Resolve appointment ID param
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

    // 3. BARBER authentication and profile resolution
    const authResult = await authenticateBarberApi(requestId);
    if (!authResult.user || !authResult.barberProfile) {
      return authResult.response;
    }

    // 4. Parse request body
    let body: unknown;
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

    const parsed = TransitionAppointmentStatusSchema.safeParse(body);
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

    // 5. Execute use case
    const input: TransitionAppointmentStatusInput = {
      appointmentId: idParsed.data,
      barberProfileId: authResult.barberProfile.id,
      targetStatus: parsed.data.targetStatus as AppointmentStatus,
      cancellationReason: parsed.data.cancellationReason,
    };

    const useCase = getUseCase();
    const result = await useCase.execute(input);

    return NextResponse.json({
      data: toBarberAppointmentDto(result.appointment),
    });
  } catch (error: unknown) {
    logger.error(
      { requestId, err: error },
      "Failed to transition appointment status",
    );

    const errName = error instanceof Error ? error.name : "";
    const errMsg = error instanceof Error ? error.message : "Error";

    // Foreign / nonexistent appointment isolation
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

    // Operational and domain transition errors
    if (
      errName === "InvalidAppointmentStatusTransitionError" ||
      errName === "NoShowGracePeriodNotElapsedError" ||
      errName === "CancellationReasonRequiredError"
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
