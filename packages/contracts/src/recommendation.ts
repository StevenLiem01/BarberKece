import { z } from "zod";
import {
  FaceShapeEnum,
  HairTypeEnum,
  HairDensityEnum,
  HairLengthEnum,
  MaintenanceLevelEnum,
} from "./identity.js";

export const TransientRecommendationSchema = z
  .object({
    mode: z.literal("transient"),
    faceShape: FaceShapeEnum.optional().nullable(),
    hairType: HairTypeEnum.optional().nullable(),
    hairDensity: HairDensityEnum.optional().nullable(),
    hairLength: HairLengthEnum.optional().nullable(),
    maintenance: MaintenanceLevelEnum.optional().nullable(),
    styleTags: z.array(z.string().trim().min(1).max(50)).optional().nullable(),
  })
  .strict();

export const SavedProfileRecommendationSchema = z
  .object({
    mode: z.literal("saved-profile"),
  })
  .strict();

export const GenerateRecommendationSchema = z.discriminatedUnion("mode", [
  TransientRecommendationSchema,
  SavedProfileRecommendationSchema,
]);

export type GenerateRecommendationRequest = z.infer<
  typeof GenerateRecommendationSchema
>;

export interface RecommendedHairstyleDto {
  id: string;
  name: string;
  shortDescription: string;
  previewImageUrl: string | null;
  score: number;
  matchPercentage: number;
  reasons: string[];
  cautions: string[];
  isGrowOutOption: boolean;
}

export interface RecommendationResponseDto {
  topMatches: RecommendedHairstyleDto[];
  growOutOptions: RecommendedHairstyleDto[];
}
