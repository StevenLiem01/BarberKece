import { HairstyleKnowledgeRepository } from "../repository.js";
import {
  scoreHairstyles,
  RecommendationInput,
  ScoredHairstyle,
} from "../scoring.js";
import {
  HairProfileRepository,
  normalizeStyleTags,
} from "../../identity/index.js";

export type GenerateRecommendationsInput =
  | { mode: "transient"; input: RecommendationInput }
  | { mode: "saved-profile"; customerId: string };

export class RecommendationError extends Error {
  constructor(
    public readonly code: "INSUFFICIENT_INPUT" | "NO_SAVED_PROFILE",
    message: string,
  ) {
    super(message);
    this.name = "RecommendationError";
  }
}

export interface GenerateRecommendationsOutput {
  topMatches: ScoredHairstyle[];
  growOutOptions: ScoredHairstyle[];
}

export async function generateRecommendations(
  input: GenerateRecommendationsInput,
  knowledgeRepo: HairstyleKnowledgeRepository,
  hairProfileRepo?: HairProfileRepository,
): Promise<GenerateRecommendationsOutput> {
  let scoringInput: RecommendationInput;

  if (input.mode === "saved-profile") {
    if (!hairProfileRepo) {
      throw new Error(
        "HairProfileRepository is required for saved-profile mode",
      );
    }
    const profile = await hairProfileRepo.getHairProfileByCustomerId(
      input.customerId,
    );
    if (!profile) {
      throw new RecommendationError(
        "NO_SAVED_PROFILE",
        "Customer has no saved hair profile",
      );
    }
    scoringInput = {
      faceShape: profile.faceShape ?? undefined,
      hairType: profile.hairType ?? undefined,
      hairDensity: profile.hairDensity ?? undefined,
      hairLength: profile.hairLength ?? undefined,
      maintenance: profile.maintenance ?? undefined,
      styleTags: profile.styleTags,
    };
  } else {
    // transient mode
    scoringInput = {
      faceShape: input.input.faceShape,
      hairType: input.input.hairType,
      hairDensity: input.input.hairDensity,
      hairLength: input.input.hairLength,
      maintenance: input.input.maintenance,
      styleTags: normalizeStyleTags(input.input.styleTags) ?? undefined,
    };
  }

  const knowledgeBase = await knowledgeRepo.findAll();
  const result = scoreHairstyles(scoringInput, knowledgeBase);

  if (result.error === "INSUFFICIENT_INPUT") {
    throw new RecommendationError(
      "INSUFFICIENT_INPUT",
      "Not enough input data to generate recommendations",
    );
  }

  return {
    topMatches: result.topMatches,
    growOutOptions: result.growOutOptions,
  };
}
