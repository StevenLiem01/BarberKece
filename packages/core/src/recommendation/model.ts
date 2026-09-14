export const FACE_SHAPES = [
  "Oval",
  "Round",
  "Square",
  "Oblong / Rectangle",
  "Heart",
  "Diamond",
  "Triangle",
] as const;
export type FaceShape = (typeof FACE_SHAPES)[number];

export const HAIR_TYPES = ["Straight", "Wavy", "Curly", "Coily"] as const;
export type HairType = (typeof HAIR_TYPES)[number];

export const HAIR_DENSITIES = [
  "Thin / Low Density",
  "Medium",
  "Thick / High Density",
] as const;
export type HairDensity = (typeof HAIR_DENSITIES)[number];

export const HAIR_LENGTHS = ["Very Short", "Short", "Medium", "Long"] as const;
export type HairLength = (typeof HAIR_LENGTHS)[number];

export const MAINTENANCE_LEVELS = [
  "Very Low",
  "Low",
  "Medium",
  "High",
] as const;
export type MaintenanceLevel = (typeof MAINTENANCE_LEVELS)[number];

export const STYLING_DIFFICULTIES = ["Low", "Medium", "High"] as const;
export type StylingDifficulty = (typeof STYLING_DIFFICULTIES)[number];

export type CompatibilityScore = 0.0 | 0.5 | 0.75 | 1.0;

export interface HairstyleCompatibility {
  faceShape?: Partial<Record<FaceShape, CompatibilityScore>>;
  hairType?: Partial<Record<HairType, CompatibilityScore>>;
  hairThickness?: Partial<Record<HairDensity, CompatibilityScore>>;
}

export interface HairstyleKnowledge {
  id: string;
  name: string;
  aliases: string[];
  shortDescription: string;
  longDescription: string;
  previewImages: { url: string; displayOrder: number }[];
  virtualFilterAssetRef?: string | null;
  minimumHairLength: HairLength;
  recommendedHairLength: HairLength;
  maintenanceLevel: MaintenanceLevel;
  stylingDifficulty: StylingDifficulty;
  styleTags: string[];
  professionalNotes?: string | null;
  commonMistakes?: string | null;
  recommendedProductsPlaceholder?: string | null;
  compatibility: HairstyleCompatibility;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
