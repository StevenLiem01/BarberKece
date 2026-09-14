import { HairProfile } from "../models/hair-profile.js";

export interface SaveHairProfileInput {
  customerId: string;
  faceShape?: string | null;
  hairType?: string | null;
  hairDensity?: string | null;
  hairLength?: string | null;
  maintenance?: string | null;
  styleTags?: string[] | null;
}

export interface HairProfileRepository {
  getHairProfileByCustomerId(customerId: string): Promise<HairProfile | null>;
  saveHairProfile(input: SaveHairProfileInput): Promise<HairProfile>;
}
