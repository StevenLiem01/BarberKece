import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  RecommendationsClient,
  buildTransientPayload,
  hasUsableTransientFactors,
  parseRecommendationEnvelope,
  performRecommendationFetch,
} from "../client";
import type {
  RecommendationResponseDto,
  RecommendedHairstyleDto,
} from "@barberkece/contracts";

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("RecommendationsClient - Presentation & Payload Invariants", () => {
  const mockTopMatch: RecommendedHairstyleDto = {
    id: "uuid-top-match-1111",
    name: "Classic Textured Crop",
    shortDescription:
      "A versatile modern crop with textured top and clean sides.",
    previewImageUrl: "https://barberkece.com/images/crop.jpg",
    score: 0.9125,
    matchPercentage: 0.91,
    reasons: [
      "Complements your oval face shape beautifully",
      "Works great with your straight hair type",
    ],
    cautions: ["Requires styling powder for optimal texture"],
    isGrowOutOption: false,
  };

  const mockSecondMatch: RecommendedHairstyleDto = {
    id: "uuid-second-match-2222",
    name: "Low Taper Fade",
    shortDescription: "Subtle clean fade tapering at the neck and sideburns.",
    previewImageUrl: null, // Test preview fallback
    score: 0.845,
    matchPercentage: 0.85,
    reasons: ["Low maintenance daily routine"],
    cautions: [],
    isGrowOutOption: false,
  };

  const mockThirdMatch: RecommendedHairstyleDto = {
    id: "uuid-third-match-3333",
    name: "Executive Pompadour",
    shortDescription: "Voluminous swept-back classic haircut.",
    previewImageUrl: "https://barberkece.com/images/pomp.jpg",
    score: 0.789,
    matchPercentage: 0.79,
    reasons: ["Ideal for professional settings"],
    cautions: ["Requires regular blow-drying"],
    isGrowOutOption: false,
  };

  const mockGrowOutOption: RecommendedHairstyleDto = {
    id: "uuid-grow-out-4444",
    name: "Medium Flow Bro Flow",
    shortDescription: "Natural sweeping hair requiring shoulder-length growth.",
    previewImageUrl: null,
    score: 0.88,
    matchPercentage: 0.88,
    reasons: ["Excellent harmony with your facial symmetry"],
    cautions: ["Needs approximately 4-6 months of growth"],
    isGrowOutOption: true,
  };

  const mockFullData: RecommendationResponseDto = {
    topMatches: [mockTopMatch, mockSecondMatch, mockThirdMatch],
    growOutOptions: [mockGrowOutOption],
  };

  beforeEach(() => {
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  describe("Network Boundary & API Response Envelope Unwrapping", () => {
    it("performs live fetch, sends flat transient payload, and unwraps { data: ... } envelope", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockFullData,
        }),
      });
      globalThis.fetch = mockFetch;

      const payload = {
        mode: "transient",
        faceShape: "Oval",
      };

      const result = await performRecommendationFetch(payload);

      // Verifies fetch was called with exact endpoint, headers, and body
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Verifies unwrapped inner RecommendationResponseDto
      expect(result).toEqual(mockFullData);
      expect(result.topMatches.length).toBe(3);
      expect(result.growOutOptions.length).toBe(1);

      // Verifies unwrapped result renders without crashing
      const html = renderClean(<RecommendationsClient initialData={result} />);
      expect(html).toContain("Classic Textured Crop");
      expect(html).toContain("91% Match");
    });

    it("fails safely into error state if response is not ok", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      globalThis.fetch = mockFetch;

      await expect(
        performRecommendationFetch({ mode: "transient" }),
      ).rejects.toThrow("Failed to fetch recommendations");
    });

    it("rejects malformed response envelope missing the data wrapper", () => {
      const malformedJson = {
        topMatches: [],
        growOutOptions: [],
      };

      expect(() => parseRecommendationEnvelope(malformedJson)).toThrow(
        "Invalid recommendation response envelope",
      );
    });

    it("rejects malformed response structure inside the data envelope", () => {
      const malformedData = {
        data: {
          topMatches: "not-an-array",
        },
      };

      expect(() => parseRecommendationEnvelope(malformedData)).toThrow(
        "Malformed recommendation response structure",
      );
    });
  });

  describe("Empty / Fully-Invalid URL State Handling (Recovery Path)", () => {
    it("detects zero usable recommendation factors when search params are empty", () => {
      const emptyParams = new URLSearchParams();
      const payload = buildTransientPayload(emptyParams);

      expect(hasUsableTransientFactors(payload)).toBe(false);
    });

    it("detects zero usable recommendation factors when all search params are invalid/tampered", () => {
      const tamperedParams = new URLSearchParams({
        faceShape: "NON_EXISTENT_SHAPE",
        hairType: "INVALID_TYPE",
        hairDensity: "UNKNOWN_DENSITY",
      });
      const payload = buildTransientPayload(tamperedParams);

      expect(hasUsableTransientFactors(payload)).toBe(false);
    });

    it("renders recoverable empty-input state directing user to take the quiz", () => {
      const html = renderClean(
        <RecommendationsClient initialEmptyInput={true} />,
      );

      expect(html).toContain("No Profile Selected");
      expect(html).toContain(
        "We need to know a little about your hair to recommend the best styles",
      );
      expect(html).toContain("Take the Quiz");
      expect(html).not.toContain("Error");
      expect(html).not.toContain("Analyzing Profile...");
    });
  });

  describe("Payload Formulation from Search Params (M5-04 Flat Transient Contract)", () => {
    it("parses valid search params into exact M5-04 flat transient payload", () => {
      const searchParams = new URLSearchParams({
        faceShape: "Oval",
        hairType: "Straight",
        hairDensity: "Thick / High Density",
        hairLength: "Short",
        maintenance: "Low",
      });
      searchParams.append("styleTags", "Modern");
      searchParams.append("styleTags", "Clean");

      const payload = buildTransientPayload(searchParams);

      expect(payload).toEqual({
        mode: "transient",
        faceShape: "Oval",
        hairType: "Straight",
        hairDensity: "Thick / High Density",
        hairLength: "Short",
        maintenance: "Low",
        styleTags: ["Modern", "Clean"],
      });
      expect(hasUsableTransientFactors(payload)).toBe(true);
    });

    it("omitted values are absent from the payload object", () => {
      const partialParams = new URLSearchParams({
        faceShape: "Round",
      });

      const payload = buildTransientPayload(partialParams);

      expect(payload).toEqual({
        mode: "transient",
        faceShape: "Round",
      });
      expect("hairType" in payload).toBe(false);
      expect("hairDensity" in payload).toBe(false);
      expect("hairLength" in payload).toBe(false);
      expect("maintenance" in payload).toBe(false);
      expect("styleTags" in payload).toBe(false);
      expect(hasUsableTransientFactors(payload)).toBe(true);
    });

    it("fails safely and ignores invalid/tampered URL query parameters", () => {
      const tamperedParams = new URLSearchParams({
        faceShape: "ALIEN_OCTAGON",
        hairType: "RADIOACTIVE_SPIKES",
        hairDensity: "IMPOSSIBLE",
        hairLength: "INFINITE",
        maintenance: "ZERO_EFFORT",
      });

      const payload = buildTransientPayload(tamperedParams);

      // Tampered/invalid enums are stripped away safely
      expect(payload).toEqual({
        mode: "transient",
      });
      expect(hasUsableTransientFactors(payload)).toBe(false);
    });
  });

  describe("Loading, Error & Empty States", () => {
    it("renders loading state with skeleton/spinner indicator", () => {
      const html = renderClean(<RecommendationsClient initialLoading={true} />);

      expect(html).toContain("Analyzing Profile...");
      expect(html).toContain("animate-spin");
      expect(html).not.toContain("Curated For");
    });

    it("renders API failure state with user-friendly error and retry buttons", () => {
      const html = renderClean(
        <RecommendationsClient initialError="Something went wrong loading your recommendations. Please try again." />,
      );

      expect(html).toContain("Error");
      expect(html).toContain(
        "Something went wrong loading your recommendations",
      );
      expect(html).toContain("Retry");
      expect(html).toContain("Try Again");
    });

    it("supports retry behavior trigger", () => {
      const onRetryMock = vi.fn();
      const html = renderClean(
        <RecommendationsClient
          initialError="Failed network request"
          onRetry={onRetryMock}
        />,
      );

      expect(html).toContain("Retry");
    });

    it("renders empty recommendation result state when no matches found", () => {
      const html = renderClean(
        <RecommendationsClient
          initialData={{ topMatches: [], growOutOptions: [] }}
        />,
      );

      expect(html).toContain("No Matches Found");
      expect(html).toContain("Adjust Preferences");
    });
  });

  describe("Recommendation Hierarchy & Component Layout", () => {
    it("#1 recommendation is rendered as the dominant hero result", () => {
      const html = renderClean(
        <RecommendationsClient initialData={mockFullData} />,
      );

      expect(html).toContain("#1");
      expect(html).toContain("Top Recommendation");
      expect(html).toContain("Classic Textured Crop");
      expect(html).toContain("91% Match");
      expect(html).toContain(mockTopMatch.shortDescription);
    });

    it("#2 and #3 secondary recommendations render under Great Alternatives", () => {
      const html = renderClean(
        <RecommendationsClient initialData={mockFullData} />,
      );

      expect(html).toContain("Great Alternatives");
      expect(html).toContain("#2");
      expect(html).toContain("Low Taper Fade");
      expect(html).toContain("85% Match");
      expect(html).toContain("#3");
      expect(html).toContain("Executive Pompadour");
      expect(html).toContain("79% Match");
    });

    it("handles fewer than 3 results without rendering absent positions", () => {
      const singleMatchData: RecommendationResponseDto = {
        topMatches: [mockTopMatch],
        growOutOptions: [],
      };

      const html = renderClean(
        <RecommendationsClient initialData={singleMatchData} />,
      );

      expect(html).toContain("Classic Textured Crop");
      expect(html).not.toContain("Great Alternatives");
      expect(html).not.toContain("#2");
      expect(html).not.toContain("#3");
    });

    it("renders grow-out options in a separate dedicated section", () => {
      const html = renderClean(
        <RecommendationsClient initialData={mockFullData} />,
      );

      expect(html).toContain("Future Goals");
      expect(html).toContain(
        "These styles require more length than you currently have",
      );
      expect(html).toContain("Medium Flow Bro Flow");
    });
  });

  describe("Explanations, Fallbacks & Private Field Protection", () => {
    it("renders why-it-works reasons with checkmark indicators", () => {
      const html = renderClean(
        <RecommendationsClient initialData={mockFullData} />,
      );

      expect(html).toContain("Why it works for you");
      expect(html).toContain("Complements your oval face shape beautifully");
      expect(html).toContain("Works great with your straight hair type");
      expect(html).toContain("✓");
    });

    it("renders cautions with consideration indicators when present", () => {
      const html = renderClean(
        <RecommendationsClient initialData={mockFullData} />,
      );

      expect(html).toContain("Things to consider");
      expect(html).toContain("Requires styling powder for optimal texture");
      expect(html).toContain("!");
    });

    it("renders visual preview image or fallback placeholder gracefully", () => {
      const html = renderClean(
        <RecommendationsClient initialData={mockFullData} />,
      );

      // Top match has valid preview image
      expect(html).toContain('src="https://barberkece.com/images/crop.jpg"');

      // Second match has null preview image -> renders fallback
      expect(html).toContain("No Preview");
    });

    it("does NOT render private or internal fields (raw score, database UUIDs)", () => {
      const html = renderClean(
        <RecommendationsClient initialData={mockFullData} />,
      );

      // Public percentage is rendered
      expect(html).toContain("91% Match");

      // Raw unrounded internal score (0.9125) must NOT be rendered
      expect(html).not.toContain("0.9125");
      expect(html).not.toContain("0.845");

      // Raw database UUIDs must NOT be exposed in visible content
      expect(html).not.toContain("uuid-top-match-1111");
      expect(html).not.toContain("uuid-second-match-2222");
    });

    it("does NOT render dead booking CTA buttons", () => {
      const html = renderClean(
        <RecommendationsClient initialData={mockFullData} />,
      );

      expect(html).not.toContain("Book This Style");
      expect(html).not.toContain("Book Style");
    });
  });
});
