import {
  HairstyleKnowledge,
  FaceShape,
  HairType,
  HairDensity,
  HairLength,
  MaintenanceLevel,
} from "./model.js";

export interface RecommendationInput {
  faceShape?: FaceShape;
  hairType?: HairType;
  hairDensity?: HairDensity;
  hairLength?: HairLength;
  maintenance?: MaintenanceLevel;
  styleTags?: string[];
}

export interface RecommendationExplanation {
  matchPercentage: number;
  reasons: string[];
  cautions: string[];
}

export interface ScoredHairstyle {
  knowledge: HairstyleKnowledge;
  score: number;
  explanation: RecommendationExplanation;
  isGrowOutOption: boolean;
}

export interface RecommendationResult {
  topMatches: ScoredHairstyle[];
  growOutOptions: ScoredHairstyle[];
  error?: "INSUFFICIENT_INPUT";
}

const WEIGHTS = {
  faceShape: 25,
  hairType: 20,
  hairDensity: 15,
  hairLength: 15,
  maintenance: 10,
  stylePreference: 15,
};

const LENGTH_ORDER: Record<HairLength, number> = {
  "Very Short": 0,
  Short: 1,
  Medium: 2,
  Long: 3,
};

const MAINTENANCE_ORDER: Record<MaintenanceLevel, number> = {
  "Very Low": 0,
  Low: 1,
  Medium: 2,
  High: 3,
};

function getLengthScore(
  input: HairLength,
  min: HairLength,
  recommended: HairLength,
): number {
  const inputVal = LENGTH_ORDER[input];
  const minVal = LENGTH_ORDER[min];
  const recVal = LENGTH_ORDER[recommended];

  if (inputVal >= recVal) return 1.0;
  if (inputVal >= minVal) return 0.75;
  return 0.0; // This will also be a grow-out option
}

function getMaintenanceScore(
  preference: MaintenanceLevel,
  requirement: MaintenanceLevel,
): number {
  const prefVal = MAINTENANCE_ORDER[preference];
  const reqVal = MAINTENANCE_ORDER[requirement];
  const diff = reqVal - prefVal;

  if (diff <= 0) return 1.0;
  if (diff === 1) return 0.75;
  if (diff === 2) return 0.5;
  return 0.0;
}

function getStyleTagsScore(desired: string[], candidate: string[]): number {
  if (desired.length === 0) return 0;
  const uniqueDesired = Array.from(new Set(desired));
  const candidateLower = candidate.map((t) => t.toLowerCase());

  let overlap = 0;
  for (const tag of uniqueDesired) {
    if (candidateLower.includes(tag.toLowerCase())) {
      overlap++;
    }
  }

  const ratio = overlap / uniqueDesired.length;
  if (ratio === 0) return 0.0;
  if (ratio > 0 && ratio < 0.5) return 0.5;
  if (ratio >= 0.5 && ratio < 1) return 0.75;
  return 1.0;
}

export function scoreHairstyles(
  input: RecommendationInput,
  knowledgeBase: HairstyleKnowledge[],
): RecommendationResult {
  const activeStyles = knowledgeBase.filter((k) => k.isActive);

  const providedTags = input.styleTags
    ? Array.from(new Set(input.styleTags))
    : [];

  let activeWeightSum = 0;
  if (input.faceShape) activeWeightSum += WEIGHTS.faceShape;
  if (input.hairType) activeWeightSum += WEIGHTS.hairType;
  if (input.hairDensity) activeWeightSum += WEIGHTS.hairDensity;
  if (input.hairLength) activeWeightSum += WEIGHTS.hairLength;
  if (input.maintenance) activeWeightSum += WEIGHTS.maintenance;
  if (providedTags.length > 0) activeWeightSum += WEIGHTS.stylePreference;

  if (activeWeightSum === 0) {
    return {
      topMatches: [],
      growOutOptions: [],
      error: "INSUFFICIENT_INPUT",
    };
  }

  const scored: ScoredHairstyle[] = activeStyles.map((knowledge) => {
    let rawScore = 0;
    const reasons: string[] = [];
    const cautions: string[] = [];
    let isGrowOutOption = false;

    if (input.faceShape) {
      const s = knowledge.compatibility.faceShape?.[input.faceShape] ?? 0;
      rawScore += s * WEIGHTS.faceShape;
      if (s >= 0.75)
        reasons.push(
          `Excellent match for ${input.faceShape.toLowerCase()} face shape.`,
        );
      else if (s === 0.5)
        reasons.push(
          `Acceptable for ${input.faceShape.toLowerCase()} face shape.`,
        );
    }

    if (input.hairType) {
      const s = knowledge.compatibility.hairType?.[input.hairType] ?? 0;
      rawScore += s * WEIGHTS.hairType;
      if (s >= 0.75)
        reasons.push(`Works well with ${input.hairType.toLowerCase()} hair.`);
    }

    if (input.hairDensity) {
      const s = knowledge.compatibility.hairDensity?.[input.hairDensity] ?? 0;
      rawScore += s * WEIGHTS.hairDensity;
      if (s >= 0.75) reasons.push(`Ideal for your hair density.`);
    }

    if (input.hairLength) {
      const s = getLengthScore(
        input.hairLength,
        knowledge.minimumHairLength,
        knowledge.recommendedHairLength,
      );
      rawScore += s * WEIGHTS.hairLength;

      const inputVal = LENGTH_ORDER[input.hairLength];
      const minVal = LENGTH_ORDER[knowledge.minimumHairLength];

      if (inputVal < minVal) {
        isGrowOutOption = true;
        cautions.push(
          `Requires longer hair (currently ${input.hairLength.toLowerCase()}, needs ${knowledge.minimumHairLength.toLowerCase()}).`,
        );
      } else {
        reasons.push(`Current length is sufficient for this style.`);
      }
    }

    if (input.maintenance) {
      const s = getMaintenanceScore(
        input.maintenance,
        knowledge.maintenanceLevel,
      );
      rawScore += s * WEIGHTS.maintenance;

      if (s === 1.0) {
        reasons.push(
          `Matches your ${input.maintenance.toLowerCase()} maintenance preference.`,
        );
      } else if (s === 0.75) {
        cautions.push(
          `Slightly higher maintenance (${knowledge.maintenanceLevel.toLowerCase()}) than preferred.`,
        );
      } else {
        cautions.push(
          `Higher maintenance (${knowledge.maintenanceLevel.toLowerCase()}) than preferred.`,
        );
      }
    }

    if (providedTags.length > 0) {
      const s = getStyleTagsScore(providedTags, knowledge.styleTags);
      rawScore += s * WEIGHTS.stylePreference;
      if (s >= 0.75) reasons.push(`Strongly aligns with your desired style.`);
    }

    const finalScore = rawScore / activeWeightSum;
    const matchPercentage = Math.round(finalScore * 100);

    // Limit reasons to 2-4 useful ones deterministically
    const finalReasons = reasons.slice(0, 4);

    return {
      knowledge,
      score: finalScore,
      explanation: {
        matchPercentage,
        reasons: finalReasons,
        cautions,
      },
      isGrowOutOption,
    };
  });

  // Sort and tie-break
  scored.sort((a, b) => {
    // 1. finalScore DESC
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // 2. normalized name ASC
    const nameA = a.knowledge.name.toLowerCase();
    const nameB = b.knowledge.name.toLowerCase();
    if (nameA !== nameB) {
      // locale-independent deterministic comparison
      return nameA > nameB ? 1 : -1;
    }
    // 3. stable ID ASC
    if (a.knowledge.id !== b.knowledge.id) {
      return a.knowledge.id > b.knowledge.id ? 1 : -1;
    }
    return 0;
  });

  const immediate = scored.filter((s) => !s.isGrowOutOption);
  const growOut = scored.filter((s) => s.isGrowOutOption);

  return {
    topMatches: immediate.slice(0, 3),
    growOutOptions: growOut,
  };
}
