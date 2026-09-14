import { NextRequest, NextResponse } from "next/server";
import { getHairProfile, saveHairProfile } from "@barberkece/core/identity";
import { PostgresHairProfileRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateCustomerApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";
import { SaveHairProfileSchema } from "@barberkece/contracts";

export const runtime = "nodejs";

let hairProfileRepository: PostgresHairProfileRepository | undefined;

function getHairProfileRepository() {
  if (!hairProfileRepository) {
    const dbClient = getDatabaseClient();
    hairProfileRepository = new PostgresHairProfileRepository(dbClient.db);
  }
  return hairProfileRepository;
}

export async function GET() {
  const requestId = generateRequestId();

  try {
    const authResult = await authenticateCustomerApi(requestId);
    if (!authResult.user) {
      return authResult.response;
    }

    const repo = getHairProfileRepository();
    const profile = await getHairProfile(authResult.user.id, repo);

    return NextResponse.json({
      data: profile,
    });
  } catch (error: unknown) {
    logger.error(
      { requestId, err: error },
      "Failed to get customer hair profile",
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

export async function PUT(req: NextRequest) {
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

    const parsed = SaveHairProfileSchema.safeParse(body);
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

    const repo = getHairProfileRepository();

    const profile = await saveHairProfile(
      {
        customerId: authResult.user.id,
        faceShape: parsed.data.faceShape,
        hairType: parsed.data.hairType,
        hairDensity: parsed.data.hairDensity,
        hairLength: parsed.data.hairLength,
        maintenance: parsed.data.maintenance,
        styleTags: parsed.data.styleTags,
      },
      repo,
    );

    return NextResponse.json({ data: profile }, { status: 200 });
  } catch (error: unknown) {
    logger.error(
      { requestId, err: error },
      "Failed to save customer hair profile",
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
