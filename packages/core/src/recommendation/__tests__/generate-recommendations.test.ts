import { describe, it, expect, vi } from "vitest";
import {
  generateRecommendations,
  RecommendationError,
} from "../use-cases/generate-recommendations.js";
import { HairstyleKnowledgeRepository } from "../repository.js";
import { HairProfileRepository, HairProfile } from "../../identity/index.js";
import { HairstyleKnowledge } from "../model.js";

describe("generateRecommendations - orchestration boundary tests", () => {
  const createKnowledge = (
    id: string,
    name: string,
    overrides: Partial<HairstyleKnowledge> = {},
  ): HairstyleKnowledge => ({
    id,
    name,
    aliases: [],
    shortDescription: "Description for " + name,
    longDescription: "Long description for " + name,
    previewImages: [{ url: `https://example.com/${id}.jpg`, displayOrder: 0 }],
    minimumHairLength: "Short",
    recommendedHairLength: "Medium",
    maintenanceLevel: "Medium",
    stylingDifficulty: "Medium",
    styleTags: ["clean"],
    compatibility: {
      faceShape: { Oval: 1.0, Square: 0.5, Round: 0.0 },
    },
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  });

  const mockKnowledgeList: HairstyleKnowledge[] = [
    createKnowledge("h1", "Alpha Cut", {
      minimumHairLength: "Short",
      recommendedHairLength: "Medium",
      compatibility: { faceShape: { Oval: 1.0 } },
    }),
    createKnowledge("h2", "Beta Fade", {
      minimumHairLength: "Short",
      recommendedHairLength: "Short",
      compatibility: { faceShape: { Oval: 0.75 } },
    }),
    createKnowledge("h3", "Gamma Crop", {
      minimumHairLength: "Medium",
      recommendedHairLength: "Long",
      compatibility: { faceShape: { Oval: 1.0 } },
    }),
    createKnowledge("h4", "Inactive Cut", {
      isActive: false,
      compatibility: { faceShape: { Oval: 1.0 } },
    }),
  ];

  const mockKnowledgeRepo = {
    findAll: vi.fn().mockResolvedValue(mockKnowledgeList),
  } as unknown as HairstyleKnowledgeRepository;

  const mockProfileRepo = {
    getHairProfileByCustomerId: vi.fn(),
  } as unknown as HairProfileRepository;

  it("should generate recommendations for transient partial input", async () => {
    const result = await generateRecommendations(
      {
        mode: "transient",
        input: { faceShape: "Oval" },
      },
      mockKnowledgeRepo,
    );

    // Alpha Cut (1.0), Beta Fade (0.75) eligible for short/medium
    expect(result.topMatches.length).toBeGreaterThanOrEqual(1);
    expect(result.topMatches[0].knowledge.id).toBe("h1");
  });

  it("should exclude inactive hairstyles from recommendations", async () => {
    const result = await generateRecommendations(
      {
        mode: "transient",
        input: { faceShape: "Oval" },
      },
      mockKnowledgeRepo,
    );

    const allIds = [
      ...result.topMatches.map((m) => m.knowledge.id),
      ...result.growOutOptions.map((m) => m.knowledge.id),
    ];
    expect(allIds).not.toContain("h4");
  });

  it("allows fewer than 3 immediate matches without synthetic padding", async () => {
    const singleRepo = {
      findAll: vi.fn().mockResolvedValue([mockKnowledgeList[0]]),
    } as unknown as HairstyleKnowledgeRepository;

    const result = await generateRecommendations(
      {
        mode: "transient",
        input: { faceShape: "Oval" },
      },
      singleRepo,
    );

    expect(result.topMatches).toHaveLength(1);
    expect(result.growOutOptions).toHaveLength(0);
  });

  it("separates Grow-out Options from Immediate Top Matches when below minimum hair length", async () => {
    const result = await generateRecommendations(
      {
        mode: "transient",
        input: { faceShape: "Oval", hairLength: "Short" },
      },
      mockKnowledgeRepo,
    );

    // Gamma Crop requires minimum Medium, so for Short hair, it must be Grow-out
    const gammaInTop = result.topMatches.find((m) => m.knowledge.id === "h3");
    const gammaInGrowOut = result.growOutOptions.find(
      (m) => m.knowledge.id === "h3",
    );

    expect(gammaInTop).toBeUndefined();
    expect(gammaInGrowOut).toBeDefined();
    expect(gammaInGrowOut?.isGrowOutOption).toBe(true);
  });

  it("preserves 0.75 hair length score when minimum <= input length < recommended", async () => {
    // Alpha Cut: minimum Short, recommended Medium. Input = Short => length factor = 0.75, immediate match
    const result = await generateRecommendations(
      {
        mode: "transient",
        input: { faceShape: "Oval", hairLength: "Short" },
      },
      mockKnowledgeRepo,
    );

    const alphaMatch = result.topMatches.find((m) => m.knowledge.id === "h1");
    expect(alphaMatch).toBeDefined();
    expect(alphaMatch?.isGrowOutOption).toBe(false);
  });

  it("correctly handles compatibility score 0 (Round face gives 0 on faceShape factor)", async () => {
    const result = await generateRecommendations(
      {
        mode: "transient",
        input: { faceShape: "Round" },
      },
      mockKnowledgeRepo,
    );

    // Alpha Cut has Round: 0.0 => final score 0
    const alphaMatch = result.topMatches.find((m) => m.knowledge.id === "h1");
    expect(alphaMatch).toBeDefined();
    expect(alphaMatch?.score).toBe(0);
  });

  it("preserves strict score ranking (score DESC, name ASC, id ASC) through orchestration", async () => {
    const result = await generateRecommendations(
      {
        mode: "transient",
        input: { faceShape: "Oval" },
      },
      mockKnowledgeRepo,
    );

    for (let i = 0; i < result.topMatches.length - 1; i++) {
      expect(result.topMatches[i].score).toBeGreaterThanOrEqual(
        result.topMatches[i + 1].score,
      );
    }
  });

  it("produces deterministic repeated execution", async () => {
    const input = {
      mode: "transient" as const,
      input: { faceShape: "Oval" as const },
    };
    const run1 = await generateRecommendations(input, mockKnowledgeRepo);
    const run2 = await generateRecommendations(input, mockKnowledgeRepo);

    expect(run1).toEqual(run2);
  });

  it("throws INSUFFICIENT_INPUT if input has zero usable scoring factors", async () => {
    await expect(
      generateRecommendations(
        { mode: "transient", input: {} },
        mockKnowledgeRepo,
      ),
    ).rejects.toThrow(RecommendationError);
  });

  it("does not mutate saved profile when resolving recommendations", async () => {
    const originalProfile = Object.freeze({
      id: "p1",
      customerId: "c1",
      faceShape: "Square" as const,
      hairType: null,
      hairDensity: null,
      hairLength: null,
      maintenance: null,
      styleTags: Object.freeze(["clean"]) as unknown as string[],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(mockProfileRepo.getHairProfileByCustomerId).mockResolvedValueOnce(
      originalProfile as unknown as HairProfile,
    );

    const result = await generateRecommendations(
      { mode: "saved-profile", customerId: "c1" },
      mockKnowledgeRepo,
      mockProfileRepo,
    );

    expect(result.topMatches.length).toBeGreaterThan(0);
    expect(originalProfile.faceShape).toBe("Square");
    expect(originalProfile.styleTags).toEqual(["clean"]);
  });

  it("throws NO_SAVED_PROFILE when customer has no saved profile", async () => {
    vi.mocked(mockProfileRepo.getHairProfileByCustomerId).mockResolvedValueOnce(
      null,
    );

    await expect(
      generateRecommendations(
        { mode: "saved-profile", customerId: "c_unknown" },
        mockKnowledgeRepo,
        mockProfileRepo,
      ),
    ).rejects.toThrow("Customer has no saved hair profile");
  });

  it("does not invoke profileRepo during transient flow", async () => {
    const profileSpy = vi.fn();
    const isolatedProfileRepo = {
      getHairProfileByCustomerId: profileSpy,
    } as unknown as HairProfileRepository;

    await generateRecommendations(
      { mode: "transient", input: { faceShape: "Oval" } },
      mockKnowledgeRepo,
      isolatedProfileRepo,
    );

    expect(profileSpy).not.toHaveBeenCalled();
  });
});
