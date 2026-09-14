import { NextRequest, NextResponse } from "next/server";
import {
  generateRecommendations,
  RecommendationError,
  GenerateRecommendationsInput,
  ScoredHairstyle,
} from "@barberkece/core/recommendation";
import { PostgresHairstyleKnowledgeRepository } from "@barberkece/database/repositories";
import { PostgresHairProfileRepository } from "@barberkece/database/repositories";
import { generateRequestId, logger } from "@barberkece/infrastructure/logging";
import { getDatabaseClient } from "@/lib/db";
import { authenticateCustomerApi } from "@/lib/auth";
import { validateSameOrigin } from "@/lib/same-origin";
import { GenerateRecommendationSchema } from "@barberkece/contracts";

export const runtime = "nodejs";

let knowledgeRepo: PostgresHairstyleKnowledgeRepository | undefined;
let profileRepo: PostgresHairProfileRepository | undefined;

function getRepositories() {
  if (!knowledgeRepo || !profileRepo) {
    const dbClient = getDatabaseClient();
    knowledgeRepo = new PostgresHairstyleKnowledgeRepository(dbClient.db);
    profileRepo = new PostgresHairProfileRepository(dbClient.db);
  }
  return { knowledgeRepo, profileRepo };
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

    const parsed = GenerateRecommendationSchema.safeParse(body);
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

    function selectPreviewImageUrl(
      previewImages?: { url: string; displayOrder: number }[] | null,
    ): string | null {
      if (!previewImages || previewImages.length === 0) {
        return null;
      }
      const sorted = [...previewImages].sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) {
          return a.displayOrder - b.displayOrder;
        }
        return a.url.localeCompare(b.url);
      });
      return sorted[0]?.url ?? null;
    }

    const repos = getRepositories();
    let generateInput: GenerateRecommendationsInput;

    if (parsed.data.mode === "saved-profile") {
      const authResult = await authenticateCustomerApi(requestId);
      if (!authResult.user) {
        return authResult.response;
      }
      generateInput = {
        mode: "saved-profile",
        customerId: authResult.user.id,
      };
    } else {
      generateInput = {
        mode: "transient",
        input: {
          faceShape: parsed.data.faceShape ?? undefined,
          hairType: parsed.data.hairType ?? undefined,
          hairDensity: parsed.data.hairDensity ?? undefined,
          hairLength: parsed.data.hairLength ?? undefined,
          maintenance: parsed.data.maintenance ?? undefined,
          styleTags: parsed.data.styleTags ?? undefined,
        },
      };
    }

    const result = await generateRecommendations(
      generateInput,
      repos.knowledgeRepo,
      repos.profileRepo,
    );

    const mapScoredHairstyle = (scored: ScoredHairstyle) => {
      const previewImageUrl = selectPreviewImageUrl(
        scored.knowledge.previewImages,
      );
      return {
        id: scored.knowledge.id,
        name: scored.knowledge.name,
        shortDescription: scored.knowledge.shortDescription,
        previewImageUrl,
        score: scored.score,
        matchPercentage: scored.explanation.matchPercentage,
        reasons: scored.explanation.reasons,
        cautions: scored.explanation.cautions,
        isGrowOutOption: scored.isGrowOutOption,
      };
    };

    const mappedResult = {
      topMatches: result.topMatches.map(mapScoredHairstyle),
      growOutOptions: result.growOutOptions.map(mapScoredHairstyle),
    };

    return NextResponse.json({ data: mappedResult }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof RecommendationError) {
      const status = error.code === "NO_SAVED_PROFILE" ? 404 : 400;
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        },
        { status },
      );
    }

    logger.error(
      { requestId, err: error },
      "Failed to generate recommendations",
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
