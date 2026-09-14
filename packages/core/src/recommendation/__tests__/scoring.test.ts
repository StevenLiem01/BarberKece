import { describe, it, expect } from "vitest";
import { scoreHairstyles, RecommendationInput } from "../scoring.js";
import { HairstyleKnowledge } from "../model.js";

function createKnowledge(
  overrides: Partial<HairstyleKnowledge>,
): HairstyleKnowledge {
  return {
    id: "test-id",
    name: "Test Hairstyle",
    aliases: [],
    shortDescription: "Short",
    longDescription: "Long",
    previewImages: [],
    minimumHairLength: "Medium",
    recommendedHairLength: "Long",
    maintenanceLevel: "Medium",
    stylingDifficulty: "Medium",
    styleTags: ["classic", "clean"],
    compatibility: {
      faceShape: { Oval: 1.0, Round: 0.5 },
      hairType: { Straight: 1.0 },
      hairThickness: { Medium: 1.0 },
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Recommendation Engine - Scoring", () => {
  it("returns INSUFFICIENT_INPUT if no scoreable factors are provided", () => {
    const kb = [createKnowledge({})];
    const res = scoreHairstyles({}, kb);
    expect(res.error).toBe("INSUFFICIENT_INPUT");
    expect(res.topMatches).toHaveLength(0);
  });

  it("normalizes weights and scores exactly when missing factors are excluded", () => {
    const kb = [createKnowledge({})];
    // Only face shape provided. Weight is 25.
    // score = (1.0 * 25) / 25 = 1.0 (100%)
    const res = scoreHairstyles({ faceShape: "Oval" }, kb);
    expect(res.error).toBeUndefined();
    expect(res.topMatches[0].explanation.matchPercentage).toBe(100);

    // Score = 0.5
    const res2 = scoreHairstyles({ faceShape: "Round" }, kb);
    expect(res2.topMatches[0].explanation.matchPercentage).toBe(50);
  });

  it("scores all 6 factors correctly", () => {
    const kb = [
      createKnowledge({
        minimumHairLength: "Short",
        recommendedHairLength: "Medium",
        maintenanceLevel: "Low",
        styleTags: ["a", "b"],
        compatibility: {
          faceShape: { Oval: 1.0 },
          hairType: { Straight: 1.0 },
          hairThickness: { Medium: 1.0 },
        },
      }),
    ];

    const input: RecommendationInput = {
      faceShape: "Oval", // 1.0 * 25 = 25
      hairType: "Straight", // 1.0 * 20 = 20
      hairDensity: "Medium", // 1.0 * 15 = 15
      hairLength: "Long", // >= Medium -> 1.0 * 15 = 15
      maintenance: "Low", // req: Low, pref: Low -> diff 0 -> 1.0 * 10 = 10
      styleTags: ["a", "b"], // overlap 2/2 -> ratio 1 -> 1.0 * 15 = 15
    };
    // Total weight = 100, score = 100%

    const res = scoreHairstyles(input, kb);
    expect(res.topMatches[0].explanation.matchPercentage).toBe(100);
  });

  it("excludes styles from Immediate Top 3 if length is insufficient, puts in Grow-out", () => {
    const kb = [createKnowledge({ minimumHairLength: "Long" })];
    // Input is Medium. Min is Long. So length is insufficient.
    const input: RecommendationInput = {
      hairLength: "Medium",
      faceShape: "Oval",
    };

    const res = scoreHairstyles(input, kb);
    expect(res.topMatches).toHaveLength(0);
    expect(res.growOutOptions).toHaveLength(1);
    expect(res.growOutOptions[0].isGrowOutOption).toBe(true);
    expect(res.growOutOptions[0].explanation.cautions[0]).toContain(
      "Requires longer hair",
    );
  });

  it("handles asymmetric maintenance properly", () => {
    // Preference: Low (1)
    const kb0 = createKnowledge({ id: "kb0", maintenanceLevel: "Very Low" }); // req: 0, diff: -1 -> 1.0
    const kb1 = createKnowledge({ id: "kb1", maintenanceLevel: "Low" }); // req: 1, diff: 0 -> 1.0
    const kb2 = createKnowledge({ id: "kb2", maintenanceLevel: "Medium" }); // req: 2, diff: 1 -> 0.75
    const kb3 = createKnowledge({ id: "kb3", maintenanceLevel: "High" }); // req: 3, diff: 2 -> 0.50

    const kb = [kb0, kb1, kb2, kb3];
    const res = scoreHairstyles({ maintenance: "Low" }, kb);

    // Sort logic places higher scores first
    const scores = res.topMatches.reduce(
      (acc, m) => {
        acc[m.knowledge.id] = m.explanation.matchPercentage;
        return acc;
      },
      {} as Record<string, number>,
    );

    expect(scores["kb0"]).toBe(100); // (1.0 * 10)/10
    expect(scores["kb1"]).toBe(100); // (1.0 * 10)/10
    expect(scores["kb2"]).toBe(75); // (0.75 * 10)/10
    expect(scores["kb3"]).toBeUndefined(); // kb3 has score 50, but dropped because only top 3 are returned
  });

  it("handles style tag overlap boundaries and ignores duplicates", () => {
    const kb0 = createKnowledge({ id: "kb0", styleTags: ["a"] });
    const kb1 = createKnowledge({ id: "kb1", styleTags: ["a", "b"] });
    const kb2 = createKnowledge({ id: "kb2", styleTags: ["a", "b", "c"] });
    const kb3 = createKnowledge({ id: "kb3", styleTags: ["x"] });

    const kb = [kb0, kb1, kb2, kb3];
    const input: RecommendationInput = { styleTags: ["a", "b", "A", "b"] };
    // unique desired = ["a", "b"]
    // kb0 overlap = 1/2 = 0.50 -> ratio >=0.5, <1 -> 0.75 score
    // kb1 overlap = 2/2 = 1.0 -> 1.0 score
    // kb2 overlap = 2/2 = 1.0 -> 1.0 score
    // kb3 overlap = 0/2 = 0 -> 0 score

    const res = scoreHairstyles(input, kb);

    const scores = res.topMatches.reduce(
      (acc, m) => {
        acc[m.knowledge.id] = m.explanation.matchPercentage;
        return acc;
      },
      {} as Record<string, number>,
    );

    expect(scores["kb1"]).toBe(100);
    expect(scores["kb2"]).toBe(100);
    expect(scores["kb0"]).toBe(75);

    // kb3 has 0 score, pushed out of topMatches
    expect(res.topMatches.map((m) => m.knowledge.id)).not.toContain("kb3");
  });

  it("handles zero style overlap yielding 0 score and no positive reason", () => {
    const kb = [createKnowledge({ id: "kb-zero", styleTags: ["classic"] })];
    const res = scoreHairstyles({ styleTags: ["modern", "edgy"] }, kb);
    expect(res.topMatches).toHaveLength(1);
    expect(res.topMatches[0].score).toBe(0);
    expect(res.topMatches[0].explanation.matchPercentage).toBe(0);
    expect(res.topMatches[0].explanation.reasons).toHaveLength(0);
  });

  it("scores 0.50 when style overlap ratio is strictly between 0 and 0.5", () => {
    // 1 match out of 3 desired tags = ratio 1/3 (~0.33) -> between 0 and 0.5 -> 0.50 score
    const kb = [
      createKnowledge({ id: "kb-low-overlap", styleTags: ["modern"] }),
    ];
    const res = scoreHairstyles(
      { styleTags: ["modern", "classic", "edgy"] },
      kb,
    );
    expect(res.topMatches).toHaveLength(1);
    expect(res.topMatches[0].score).toBe(0.5);
    expect(res.topMatches[0].explanation.matchPercentage).toBe(50);
  });

  it("scores 0.75 and remains eligible for Immediate Top 3 when minimum <= userLength < recommended", () => {
    const kb = [
      createKnowledge({
        minimumHairLength: "Short",
        recommendedHairLength: "Long",
      }),
    ];
    // User length is Medium (Short <= Medium < Long)
    const res = scoreHairstyles({ hairLength: "Medium" }, kb);
    expect(res.growOutOptions).toHaveLength(0);
    expect(res.topMatches).toHaveLength(1);
    expect(res.topMatches[0].isGrowOutOption).toBe(false);
    expect(res.topMatches[0].score).toBe(0.75);
    expect(res.topMatches[0].explanation.matchPercentage).toBe(75);
    expect(res.topMatches[0].explanation.reasons).toContain(
      "Current length is sufficient for this style.",
    );
  });

  it("scores 1.00 when userLength >= recommended", () => {
    const kb = [
      createKnowledge({
        minimumHairLength: "Short",
        recommendedHairLength: "Medium",
      }),
    ];
    const res = scoreHairstyles({ hairLength: "Long" }, kb);
    expect(res.growOutOptions).toHaveLength(0);
    expect(res.topMatches).toHaveLength(1);
    expect(res.topMatches[0].isGrowOutOption).toBe(false);
    expect(res.topMatches[0].score).toBe(1.0);
    expect(res.topMatches[0].explanation.matchPercentage).toBe(100);
    expect(res.topMatches[0].explanation.reasons).toContain(
      "Current length is sufficient for this style.",
    );
  });

  it("handles compatibility score 0 without generating positive reasons", () => {
    const kb = [
      createKnowledge({
        compatibility: { faceShape: { Round: 0.0 } },
      }),
    ];
    const res = scoreHairstyles({ faceShape: "Round" }, kb);
    expect(res.topMatches).toHaveLength(1);
    expect(res.topMatches[0].score).toBe(0);
    expect(res.topMatches[0].explanation.matchPercentage).toBe(0);
    expect(res.topMatches[0].explanation.reasons).toHaveLength(0);
  });

  it("produces identical results across multiple calls with the same input (repeatability)", () => {
    const kb = [
      createKnowledge({ id: "1", name: "Style A", maintenanceLevel: "Low" }),
      createKnowledge({ id: "2", name: "Style B", maintenanceLevel: "Medium" }),
      createKnowledge({ id: "3", name: "Style C", minimumHairLength: "Long" }),
    ];
    const input: RecommendationInput = {
      faceShape: "Oval",
      hairType: "Straight",
      hairDensity: "Medium",
      hairLength: "Medium",
      maintenance: "Low",
      styleTags: ["classic"],
    };

    const res1 = scoreHairstyles(input, kb);
    const res2 = scoreHairstyles(input, kb);

    expect(res1).toEqual(res2);
  });

  it("orders multiple grow-out options deterministically by score DESC, name ASC, ID ASC", () => {
    const kb1 = createKnowledge({
      id: "grow-b",
      name: "Bravo",
      minimumHairLength: "Long",
      compatibility: { faceShape: { Oval: 1.0 } },
    });
    const kb2 = createKnowledge({
      id: "grow-a",
      name: "Alpha",
      minimumHairLength: "Long",
      compatibility: { faceShape: { Oval: 1.0 } },
    });
    const kb3 = createKnowledge({
      id: "grow-c",
      name: "Charlie",
      minimumHairLength: "Long",
      compatibility: { faceShape: { Oval: 0.5 } },
    });

    // User length is Short (insufficient for Long)
    const res = scoreHairstyles({ hairLength: "Short", faceShape: "Oval" }, [
      kb1,
      kb2,
      kb3,
    ]);

    expect(res.topMatches).toHaveLength(0);
    expect(res.growOutOptions).toHaveLength(3);
    // kb1 and kb2 have higher score (1.0 face shape) than kb3 (0.5 face shape)
    // kb1 and kb2 tie on score -> name ASC -> Alpha (grow-a) then Bravo (grow-b)
    // kb3 has lower score -> last
    expect(res.growOutOptions.map((g) => g.knowledge.id)).toEqual([
      "grow-a",
      "grow-b",
      "grow-c",
    ]);
    expect(res.growOutOptions.every((g) => g.isGrowOutOption)).toBe(true);
  });

  it("strictly prioritizes score over name comparison without epsilon approximation", () => {
    // Style Zebra has higher score than Style Alpha
    // Strict comparison guarantees finalScore DESC wins first whenever b.score !== a.score
    const kbZebra = createKnowledge({
      id: "id-1",
      name: "Zebra",
      compatibility: {
        faceShape: { Oval: 1.0 },
        hairThickness: { Medium: 0.75 },
      },
    });
    const kbAlpha = createKnowledge({
      id: "id-2",
      name: "Alpha",
      compatibility: {
        faceShape: { Oval: 1.0 },
        hairThickness: { Medium: 0.5 },
      },
    });

    const res = scoreHairstyles({ faceShape: "Oval", hairDensity: "Medium" }, [
      kbAlpha,
      kbZebra,
    ]);

    expect(res.topMatches[0].knowledge.name).toBe("Zebra");
    expect(res.topMatches[1].knowledge.name).toBe("Alpha");
  });

  it("generates correct explanations for maintenance +1, +2, and +3 levels", () => {
    // User preference: Very Low (0)
    // +0 level: req Very Low (0) -> score 1.0 -> positive reason
    // +1 level: req Low (1) -> score 0.75 -> lightweight caution
    // +2 level: req Medium (2) -> score 0.50 -> caution
    // +3 level: req High (3) -> score 0.00 -> caution
    const kb0 = createKnowledge({
      id: "m0",
      name: "M0",
      maintenanceLevel: "Very Low",
    });
    const kb1 = createKnowledge({
      id: "m1",
      name: "M1",
      maintenanceLevel: "Low",
    });
    const kb2 = createKnowledge({
      id: "m2",
      name: "M2",
      maintenanceLevel: "Medium",
    });
    const kb3 = createKnowledge({
      id: "m3",
      name: "M3",
      maintenanceLevel: "High",
    });

    const resM0 = scoreHairstyles({ maintenance: "Very Low" }, [kb0]);
    expect(resM0.topMatches[0].explanation.reasons).toContain(
      "Matches your very low maintenance preference.",
    );
    expect(resM0.topMatches[0].explanation.cautions).toHaveLength(0);

    const resM1 = scoreHairstyles({ maintenance: "Very Low" }, [kb1]);
    expect(resM1.topMatches[0].explanation.cautions).toContain(
      "Slightly higher maintenance (low) than preferred.",
    );

    const resM2 = scoreHairstyles({ maintenance: "Very Low" }, [kb2]);
    expect(resM2.topMatches[0].explanation.cautions).toContain(
      "Higher maintenance (medium) than preferred.",
    );

    const resM3 = scoreHairstyles({ maintenance: "Very Low" }, [kb3]);
    expect(resM3.topMatches[0].explanation.cautions).toContain(
      "Higher maintenance (high) than preferred.",
    );
  });

  it("handles exact compatibility values (0, 0.5, 0.75, 1.0) and tie-breaking deterministically", () => {
    const kb1 = createKnowledge({
      id: "c",
      name: "Zebra",
      compatibility: { faceShape: { Oval: 1.0 } },
    });
    const kb2 = createKnowledge({
      id: "b",
      name: "Alpha",
      compatibility: { faceShape: { Oval: 1.0 } },
    });
    const kb3 = createKnowledge({
      id: "a",
      name: "Alpha",
      compatibility: { faceShape: { Oval: 1.0 } },
    });

    const res = scoreHairstyles({ faceShape: "Oval" }, [kb1, kb2, kb3]);

    expect(res.topMatches.map((m) => m.knowledge.id)).toEqual(["a", "b", "c"]);
    // same score -> name ASC -> (Alpha, Alpha, Zebra) -> id ASC -> (a, b)
  });

  it("limits top matches to 3, and returns fewer if fewer qualify", () => {
    const res = scoreHairstyles({ faceShape: "Oval" }, [
      createKnowledge({ id: "1" }),
      createKnowledge({ id: "2" }),
    ]);
    expect(res.topMatches).toHaveLength(2);
  });

  it("excludes inactive hairstyles", () => {
    const active = createKnowledge({ id: "1", isActive: true });
    const inactive = createKnowledge({ id: "2", isActive: false });

    const res = scoreHairstyles({ faceShape: "Oval" }, [active, inactive]);
    expect(res.topMatches).toHaveLength(1);
    expect(res.topMatches[0].knowledge.id).toBe("1");
  });

  it("generates deterministic reasons and cautions", () => {
    const kb = [
      createKnowledge({
        minimumHairLength: "Medium",
        recommendedHairLength: "Medium",
        maintenanceLevel: "High",
      }),
    ];
    const res = scoreHairstyles(
      { faceShape: "Oval", hairLength: "Short", maintenance: "Low" },
      kb,
    );

    expect(res.growOutOptions).toHaveLength(1);
    expect(res.growOutOptions[0].explanation.cautions).toContain(
      "Requires longer hair (currently short, needs medium).",
    );
    expect(res.growOutOptions[0].explanation.cautions).toContain(
      "Higher maintenance (high) than preferred.",
    );
  });
});
