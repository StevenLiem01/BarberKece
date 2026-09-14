import { HairProfile } from "../models/hair-profile.js";
import {
  HairProfileRepository,
  SaveHairProfileInput,
} from "../ports/hair-profile-repository.js";

export async function getHairProfile(
  customerId: string,
  hairProfileRepository: HairProfileRepository,
): Promise<HairProfile | null> {
  return hairProfileRepository.getHairProfileByCustomerId(customerId);
}

export function normalizeStyleTags(tags?: string[] | null): string[] | null {
  if (!tags || tags.length === 0) {
    return null;
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      normalized.push(trimmed);
    }
  }

  return normalized.length > 0 ? normalized : null;
}

export async function saveHairProfile(
  input: SaveHairProfileInput,
  hairProfileRepository: HairProfileRepository,
): Promise<HairProfile> {
  const processedInput: SaveHairProfileInput = {
    ...input,
    styleTags: normalizeStyleTags(input.styleTags),
  };

  return hairProfileRepository.saveHairProfile(processedInput);
}
