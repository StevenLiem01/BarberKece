import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  UpdateUserDisplayNameUseCase,
  IdentityError,
} from "@barberkece/core/identity";
import { GetBarberProfileUseCase } from "@barberkece/core/barber";
import {
  PostgresBarberProfileRepository,
  PostgresUserRepository,
} from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateAdminApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";
import { toAdminBarberDto } from "@barberkece/contracts";

export const runtime = "nodejs";

const UpdateDisplayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name must not be blank")
    .max(100, "Display name must not exceed 100 characters"),
});

let barberRepository: PostgresBarberProfileRepository | undefined;
let userRepository: PostgresUserRepository | undefined;

function getUseCases() {
  if (!barberRepository) {
    const dbClient = getDatabaseClient();
    barberRepository = new PostgresBarberProfileRepository(dbClient.db);
    userRepository = new PostgresUserRepository(dbClient.db);
  }
  return {
    updateUserDisplayNameUseCase: new UpdateUserDisplayNameUseCase(
      userRepository!,
    ),
    getBarberProfileUseCase: new GetBarberProfileUseCase(barberRepository),
  };
}

/**
 * PATCH /api/v1/admin/barbers/[id]/display-name
 *
 * Sets or corrects the display name for the user account linked to the
 * given barber profile ID. This is the Admin recovery path for barbers
 * created before or without a display name.
 *
 * Authorization: ADMIN only.
 * Body: { displayName: string }
 * Returns: updated AdminBarberDto (includes missingDisplayName flag).
 */
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

    const parseResult = UpdateDisplayNameSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid display name",
            details: parseResult.error.flatten(),
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const { updateUserDisplayNameUseCase, getBarberProfileUseCase } =
      getUseCases();

    // Resolve barber profile to get the linked userId
    const barberProfile = await getBarberProfileUseCase.execute(id);

    // Update display_name on the users row
    await updateUserDisplayNameUseCase.execute({
      userId: barberProfile.userId,
      displayName: parseResult.data.displayName,
    });

    // Re-fetch the barber profile to get the updated displayName
    const updatedProfile = await getBarberProfileUseCase.execute(id);

    logger.info(
      { requestId, barberId: id, userId: barberProfile.userId },
      "Admin updated barber display name",
    );

    return NextResponse.json({
      data: toAdminBarberDto(updatedProfile),
    });
  } catch (error: unknown) {
    if (error instanceof IdentityError) {
      return NextResponse.json(
        {
          error: {
            code: "DISPLAY_NAME_ERROR",
            message: error.message,
            requestId,
          },
        },
        { status: 400 },
      );
    }

    // BarberProfileNotFoundError surfaces as a generic message with 404
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        {
          error: {
            code: "BARBER_PROFILE_NOT_FOUND",
            message: "Barber profile not found",
            requestId,
          },
        },
        { status: 404 },
      );
    }

    logger.error(
      { requestId, err: error, barberId: id },
      "Admin update barber display name failed",
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
