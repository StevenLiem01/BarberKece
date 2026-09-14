export type FaceShape =
  | "Oval"
  | "Round"
  | "Square"
  | "Oblong / Rectangle"
  | "Heart"
  | "Diamond"
  | "Triangle";
export type HairType = "Straight" | "Wavy" | "Curly" | "Coily";
export type HairDensity =
  "Thin / Low Density" | "Medium" | "Thick / High Density";
export type HairLength = "Very Short" | "Short" | "Medium" | "Long";
export type MaintenanceLevel = "Very Low" | "Low" | "Medium" | "High";
export type StylingDifficulty = "Low" | "Medium" | "High";

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
