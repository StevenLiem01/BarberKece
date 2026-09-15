import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  FindMyStyleWizard,
  STEPS,
  STYLE_TAGS,
  formSchema,
  buildRecommendationParams,
  toggleStyleTag,
} from "../wizard";
import {
  FACE_SHAPES,
  HAIR_TYPES,
  HAIR_DENSITIES,
} from "@barberkece/core/recommendation";

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("FindMyStyleWizard - Accessibility & Questionnaire Flow", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  describe("Accessibility (fieldset, legend, aria-pressed, keyboard)", () => {
    it("groups questionnaire steps semantically with fieldset and legend", () => {
      const html = renderClean(<FindMyStyleWizard initialStepIndex={0} />);

      expect(html).toContain("<fieldset");
      expect(html).toContain("</fieldset>");
      expect(html).toContain("<legend");
      expect(html).toContain("</legend>");
      expect(html).toContain("What is your");
      expect(html).toContain("face shape?");
    });

    it("exposes aria-pressed correctly for unselected vs selected options", () => {
      const unselectedHtml = renderClean(
        <FindMyStyleWizard initialStepIndex={0} />,
      );
      expect(unselectedHtml).toContain('aria-pressed="false"');
      expect(unselectedHtml).not.toContain('aria-pressed="true"');

      const selectedHtml = renderClean(
        <FindMyStyleWizard
          initialStepIndex={0}
          initialValues={{ faceShape: "Oval" }}
        />,
      );
      expect(selectedHtml).toContain('aria-pressed="true"');
      expect(selectedHtml).toContain('aria-pressed="false"');
    });

    it("renders options as keyboard-focusable interactive buttons with visible focus ring", () => {
      const html = renderClean(<FindMyStyleWizard initialStepIndex={0} />);

      expect(html).toContain('type="button"');
      expect(html).toContain("focus:ring-2");
      expect(html).toContain("focus:ring-bk-lime");
      expect(html).toContain("focus:outline-none");
    });
  });

  describe("Step Progression & Navigation", () => {
    it("defines the 7 canonical questionnaire steps in order", () => {
      const stepIds = STEPS.map((s) => s.id);
      expect(stepIds).toEqual([
        "faceShape",
        "hairType",
        "hairDensity",
        "hairLength",
        "maintenance",
        "styleTags",
        "review",
      ]);
    });

    it("renders the initial step with disabled/hidden back button", () => {
      const html = renderClean(<FindMyStyleWizard initialStepIndex={0} />);

      expect(html).toContain("Step 1 of 7");
      expect(html).toContain("Face Shape");
      expect(html).toContain("opacity-0 pointer-events-none");
    });

    it("renders intermediate steps with active back and next controls", () => {
      const html = renderClean(<FindMyStyleWizard initialStepIndex={2} />);

      expect(html).toContain("Step 3 of 7");
      expect(html).toContain("Hair Density");
      expect(html).toContain(">Back</button>");
      expect(html).toContain(">Next</button>");
    });

    it("renders the review step at step 6 with submit CTA button", () => {
      const html = renderClean(<FindMyStyleWizard initialStepIndex={6} />);

      expect(html).toContain("Step 7 of 7");
      expect(html).toContain("Review");
      expect(html).toContain("Review Your Profile");
      expect(html).toContain('type="submit"');
      expect(html).toContain("Get Recommendations");
    });
  });

  describe("Value Selection & Multi-select Personal Style Behavior", () => {
    it("renders all domain options for single-select steps", () => {
      const html = renderClean(<FindMyStyleWizard initialStepIndex={0} />);

      for (const shape of FACE_SHAPES) {
        expect(html).toContain(shape);
      }
    });

    it("renders all defined style tags on step 5", () => {
      const html = renderClean(<FindMyStyleWizard initialStepIndex={5} />);

      expect(html).toContain("Personal Style");
      for (const tag of STYLE_TAGS) {
        expect(html).toContain(tag);
      }
    });

    it("toggleStyleTag handles adding, removing, and clearing tags in multi-select mode", () => {
      let tags: string[] = [];

      // Add tag
      tags = toggleStyleTag(tags, "Modern");
      expect(tags).toEqual(["Modern"]);

      // Append second tag
      tags = toggleStyleTag(tags, "Clean");
      expect(tags).toEqual(["Modern", "Clean"]);

      // Toggle off an existing tag
      tags = toggleStyleTag(tags, "Modern");
      expect(tags).toEqual(["Clean"]);

      // Selecting null (I'm Not Sure) clears the tag list
      tags = toggleStyleTag(tags, null);
      expect(tags).toEqual([]);
    });

    it("exposes multiple aria-pressed=true buttons for multi-selected tags", () => {
      const html = renderClean(
        <FindMyStyleWizard
          initialStepIndex={5}
          initialValues={{ styleTags: ["Modern", "Edgy"] }}
        />,
      );

      const trueCount = (html.match(/aria-pressed="true"/g) || []).length;
      expect(trueCount).toBe(2);
    });
  });

  describe("Back Navigation & State Preservation", () => {
    it("preserves previous selections across steps and into review", () => {
      const initialValues = {
        faceShape: "Square" as const,
        hairType: "Wavy" as const,
        hairDensity: "Thick / High Density" as const,
        hairLength: "Medium" as const,
        maintenance: "Low" as const,
        styleTags: ["Modern", "Clean"],
      };

      const reviewHtml = renderClean(
        <FindMyStyleWizard
          initialStepIndex={6}
          initialValues={initialValues}
        />,
      );

      expect(reviewHtml).toContain("Square");
      expect(reviewHtml).toContain("Wavy");
      expect(reviewHtml).toContain("Thick / High Density");
      expect(reviewHtml).toContain("Medium");
      expect(reviewHtml).toContain("Low");
      expect(reviewHtml).toContain("Modern, Clean");
    });
  });

  describe("'I'm Not Sure' Factor Omission & Review State", () => {
    it("renders 'I'm Not Sure' button on questionnaire steps", () => {
      const html = renderClean(<FindMyStyleWizard initialStepIndex={1} />);
      expect(html).toContain("I&#x27;m Not Sure");
    });

    it("renders 'Not Sure' in the review summary when a factor is omitted/null", () => {
      const html = renderClean(
        <FindMyStyleWizard
          initialStepIndex={6}
          initialValues={{
            faceShape: "Oval",
            hairType: null,
            hairDensity: null,
            hairLength: null,
            maintenance: null,
            styleTags: [],
          }}
        />,
      );

      expect(html).toContain("Oval");
      expect(html).toContain("Not Sure");
    });
  });

  describe("URL Query Parameter Formulation & Tampering Defense", () => {
    it("generates correct URL search params on complete submission", () => {
      const params = buildRecommendationParams({
        faceShape: "Round",
        hairType: "Curly",
        hairDensity: "Medium",
        hairLength: "Short",
        maintenance: "Medium",
        styleTags: ["Classic", "Professional"],
      });

      expect(params.get("faceShape")).toBe("Round");
      expect(params.get("hairType")).toBe("Curly");
      expect(params.get("hairDensity")).toBe("Medium");
      expect(params.get("hairLength")).toBe("Short");
      expect(params.get("maintenance")).toBe("Medium");
      expect(params.getAll("styleTags")).toEqual(["Classic", "Professional"]);
    });

    it("omits null and empty factors from URL search params", () => {
      const params = buildRecommendationParams({
        faceShape: "Diamond",
        hairType: null,
        hairDensity: null,
        hairLength: null,
        maintenance: null,
        styleTags: [],
      });

      expect(params.get("faceShape")).toBe("Diamond");
      expect(params.has("hairType")).toBe(false);
      expect(params.has("hairDensity")).toBe(false);
      expect(params.has("hairLength")).toBe(false);
      expect(params.has("maintenance")).toBe(false);
      expect(params.has("styleTags")).toBe(false);
      expect(params.toString()).toBe("faceShape=Diamond");
    });

    it("fails safely without throwing when given invalid or tampered values", () => {
      const invalidInput = {
        faceShape: "TRIANGLE_ALIEN" as unknown as (typeof FACE_SHAPES)[number],
        hairType: "SUPER_SPIKY" as unknown as (typeof HAIR_TYPES)[number],
        hairDensity: "IMPOSSIBLE" as unknown as (typeof HAIR_DENSITIES)[number],
      };

      expect(formSchema.safeParse(invalidInput).success).toBe(false);

      const params = buildRecommendationParams(invalidInput);
      expect(params.toString()).toBe("");
    });
  });
});
