import { describe, it, expect, vi } from "vitest";
import {
  getHairProfile,
  saveHairProfile,
  normalizeStyleTags,
} from "../use-cases/manage-hair-profile.js";
import { HairProfileRepository } from "../ports/hair-profile-repository.js";
import { HairProfile } from "../models/hair-profile.js";

describe("Manage Hair Profile Use Case", () => {
  const mockHairProfileRepository: HairProfileRepository = {
    getHairProfileByCustomerId: vi.fn(),
    saveHairProfile: vi.fn(),
  };

  const sampleProfile: HairProfile = {
    id: "profile-1",
    customerId: "cust-1",
    faceShape: "Oval",
    hairType: "Straight",
    hairDensity: "Medium",
    hairLength: "Short",
    maintenance: "Low",
    styleTags: ["Fade", "Pompadour"],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("normalizeStyleTags", () => {
    it("trims surrounding whitespace from tags", () => {
      const result = normalizeStyleTags([
        "  fade  ",
        "\tundercut\n",
        "  buzz cut  ",
      ]);
      expect(result).toEqual(["fade", "undercut", "buzz cut"]);
    });

    it("removes whitespace-only and empty tags", () => {
      const result = normalizeStyleTags(["fade", "   ", "", "\t\n", "quiff"]);
      expect(result).toEqual(["fade", "quiff"]);
    });

    it("deduplicates tags deterministically preserving deliberate first-seen casing", () => {
      const result = normalizeStyleTags([
        "Fade",
        "fade",
        "FADE",
        "Pompadour",
        "pompadour",
      ]);
      expect(result).toEqual(["Fade", "Pompadour"]);
    });

    it("preserves deterministic ordering (insertion order)", () => {
      const result = normalizeStyleTags([
        "Undercut",
        "Fade",
        "Crop",
        "Buzz Cut",
      ]);
      expect(result).toEqual(["Undercut", "Fade", "Crop", "Buzz Cut"]);
    });

    it("does NOT truncate more than 10 valid unique tags", () => {
      const tags = [
        "Fade",
        "Taper",
        "Undercut",
        "Pompadour",
        "Crop",
        "Buzz Cut",
        "Quiff",
        "Side Part",
        "Slick Back",
        "Mullet",
        "Crew Cut",
        "French Crop",
        "Comb Over",
      ];
      expect(tags.length).toBe(13);
      const result = normalizeStyleTags(tags);
      expect(result).toEqual(tags);
      expect(result?.length).toBe(13);
    });

    it("returns null if array is null, undefined, or empty after filtering", () => {
      expect(normalizeStyleTags(null)).toBeNull();
      expect(normalizeStyleTags(undefined)).toBeNull();
      expect(normalizeStyleTags([])).toBeNull();
      expect(normalizeStyleTags(["   ", ""])).toBeNull();
    });
  });

  describe("getHairProfile", () => {
    it("delegates to hairProfileRepository.getHairProfileByCustomerId", async () => {
      vi.mocked(
        mockHairProfileRepository.getHairProfileByCustomerId,
      ).mockResolvedValueOnce(sampleProfile);

      const result = await getHairProfile("cust-1", mockHairProfileRepository);
      expect(result).toEqual(sampleProfile);
      expect(
        mockHairProfileRepository.getHairProfileByCustomerId,
      ).toHaveBeenCalledWith("cust-1");
    });
  });

  describe("saveHairProfile", () => {
    it("normalizes styleTags and delegates to repository", async () => {
      vi.mocked(
        mockHairProfileRepository.saveHairProfile,
      ).mockResolvedValueOnce(sampleProfile);

      const input = {
        customerId: "cust-1",
        faceShape: "Oval",
        styleTags: ["  Fade  ", "fade", "Pompadour", "   "],
      };

      await saveHairProfile(input, mockHairProfileRepository);

      expect(mockHairProfileRepository.saveHairProfile).toHaveBeenCalledWith({
        customerId: "cust-1",
        faceShape: "Oval",
        styleTags: ["Fade", "Pompadour"],
      });
    });

    it("normalizes empty or whitespace-only styleTags to null", async () => {
      vi.mocked(
        mockHairProfileRepository.saveHairProfile,
      ).mockResolvedValueOnce(sampleProfile);

      const input = {
        customerId: "cust-1",
        styleTags: ["   ", ""],
      };

      await saveHairProfile(input, mockHairProfileRepository);

      expect(mockHairProfileRepository.saveHairProfile).toHaveBeenCalledWith({
        customerId: "cust-1",
        styleTags: null,
      });
    });
  });
});
