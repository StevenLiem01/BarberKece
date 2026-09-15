"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  FACE_SHAPES,
  HAIR_TYPES,
  HAIR_DENSITIES,
  HAIR_LENGTHS,
  MAINTENANCE_LEVELS,
} from "@barberkece/core/recommendation";

export const STYLE_TAGS = [
  "Classic",
  "Modern",
  "Professional",
  "Edgy",
  "Low Fade",
  "Textured",
  "Messy",
  "Clean",
];

export const formSchema = z.object({
  faceShape: z.enum(FACE_SHAPES).nullable().optional(),
  hairType: z.enum(HAIR_TYPES).nullable().optional(),
  hairDensity: z.enum(HAIR_DENSITIES).nullable().optional(),
  hairLength: z.enum(HAIR_LENGTHS).nullable().optional(),
  maintenance: z.enum(MAINTENANCE_LEVELS).nullable().optional(),
  styleTags: z.array(z.string()).nullable().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

export const STEPS = [
  { id: "faceShape", title: "Face Shape", options: FACE_SHAPES },
  { id: "hairType", title: "Hair Type", options: HAIR_TYPES },
  { id: "hairDensity", title: "Hair Density", options: HAIR_DENSITIES },
  { id: "hairLength", title: "Current Length", options: HAIR_LENGTHS },
  { id: "maintenance", title: "Maintenance", options: MAINTENANCE_LEVELS },
  {
    id: "styleTags",
    title: "Personal Style",
    options: STYLE_TAGS,
    multi: true,
  },
  { id: "review", title: "Review" },
];

export function buildRecommendationParams(data: FormValues): URLSearchParams {
  const parsed = formSchema.safeParse(data);
  if (!parsed.success) {
    return new URLSearchParams();
  }
  const validData = parsed.data;
  const params = new URLSearchParams();

  if (validData.faceShape) params.set("faceShape", validData.faceShape);
  if (validData.hairType) params.set("hairType", validData.hairType);
  if (validData.hairDensity) params.set("hairDensity", validData.hairDensity);
  if (validData.hairLength) params.set("hairLength", validData.hairLength);
  if (validData.maintenance) params.set("maintenance", validData.maintenance);

  if (validData.styleTags && validData.styleTags.length > 0) {
    validData.styleTags.forEach((tag) => params.append("styleTags", tag));
  }

  return params;
}

export function toggleStyleTag(
  currentTags: string[] | null | undefined,
  tag: string | null,
): string[] {
  if (tag === null) {
    return [];
  }
  const current = currentTags || [];
  return current.includes(tag)
    ? current.filter((t) => t !== tag)
    : [...current, tag];
}

export interface FindMyStyleWizardProps {
  initialStepIndex?: number;
  initialValues?: Partial<FormValues>;
  onNavigate?: (url: string) => void;
}

export function FindMyStyleWizard({
  initialStepIndex = 0,
  initialValues,
  onNavigate,
}: FindMyStyleWizardProps = {}) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);

  const { watch, setValue, handleSubmit, getValues } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      faceShape: null,
      hairType: null,
      hairDensity: null,
      hairLength: null,
      maintenance: null,
      styleTags: [],
      ...initialValues,
    },
  });

  const formValues = watch();
  const currentStep = STEPS[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const onSubmit = (data: FormValues) => {
    const params = buildRecommendationParams(data);
    const destination = `/recommendations?${params.toString()}`;
    if (onNavigate) {
      onNavigate(destination);
    } else {
      router.push(destination);
    }
  };

  const handleSelect = (value: string | null) => {
    const fieldId = currentStep.id as keyof FormValues;

    if (currentStep.multi && fieldId === "styleTags") {
      const updatedTags = toggleStyleTag(getValues("styleTags"), value);
      setValue("styleTags", updatedTags);
    } else {
      // Single selection
      if (fieldId !== "styleTags") {
        setValue(fieldId, value as never);
      }

      // Auto-advance if not on multi-select or review step
      if (value !== undefined) {
        setTimeout(() => {
          handleNext();
        }, 300);
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-8 bg-white/5 backdrop-blur-sm border border-neutral-200 rounded-xl shadow-lg mt-8 mb-24">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm font-medium text-neutral-500 mb-2 font-barlow tracking-widest uppercase">
          <span>
            Step {currentStepIndex + 1} of {STEPS.length}
          </span>
          <span>{currentStep.title}</span>
        </div>
        <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-bk-lime h-full transition-all duration-300 ease-in-out"
            style={{
              width: `${((currentStepIndex + 1) / STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {currentStep.id !== "review" ? (
          <fieldset className="animate-in fade-in slide-in-from-bottom-4 duration-500 border-none p-0 m-0">
            <legend className="text-3xl md:text-5xl font-barlow font-bold mb-6 text-bk-ink uppercase block w-full">
              What is your <br className="hidden md:block" />{" "}
              {currentStep.title.toLowerCase()}?
            </legend>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentStep.options?.map((option) => {
                let isSelected = false;
                const fieldId = currentStep.id as keyof FormValues;

                if (currentStep.multi) {
                  isSelected =
                    (formValues[fieldId] as string[])?.includes(option) ||
                    false;
                } else {
                  isSelected = formValues[fieldId] === option;
                }

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelect(option)}
                    aria-pressed={isSelected}
                    className={`
                      p-4 rounded-lg border-2 text-left transition-all duration-200
                      font-medium text-lg focus:outline-none focus:ring-2 focus:ring-bk-lime focus:ring-offset-2
                      ${
                        isSelected
                          ? "border-bk-ink bg-bk-ink text-bk-canvas"
                          : "border-neutral-300 hover:border-bk-ink hover:bg-neutral-50 text-bk-ink"
                      }
                    `}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 pt-8 border-t border-neutral-200 text-center">
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="text-neutral-500 hover:text-bk-ink underline decoration-neutral-300 decoration-2 underline-offset-4 transition-colors font-medium"
              >
                I&apos;m Not Sure
              </button>
            </div>
          </fieldset>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl md:text-5xl font-barlow font-bold mb-6 text-bk-ink uppercase">
              Review Your Profile
            </h2>
            <div className="space-y-4 mb-8">
              {STEPS.slice(0, -1).map((step) => {
                const val = formValues[step.id as keyof FormValues];
                let displayVal = "Not Sure";

                if (Array.isArray(val)) {
                  displayVal = val.length > 0 ? val.join(", ") : "Not Sure";
                } else if (val) {
                  displayVal = val as string;
                }

                return (
                  <div
                    key={step.id}
                    className="flex flex-col sm:flex-row sm:justify-between py-3 border-b border-neutral-200 last:border-0"
                  >
                    <span className="font-barlow text-neutral-500 text-lg uppercase tracking-wider">
                      {step.title}
                    </span>
                    <span className="font-medium text-lg text-bk-ink">
                      {displayVal}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-between mt-12">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStepIndex === 0}
            className={`
              px-6 py-3 rounded-none border-2 border-bk-ink font-barlow text-lg tracking-widest uppercase transition-colors
              ${currentStepIndex === 0 ? "opacity-0 pointer-events-none" : "hover:bg-neutral-100"}
            `}
          >
            Back
          </button>

          {currentStepIndex === STEPS.length - 1 ? (
            <button
              type="submit"
              className="px-8 py-3 bg-bk-lime text-bk-ink border-2 border-bk-ink font-barlow font-bold text-lg tracking-widest uppercase hover:bg-bk-ink hover:text-bk-canvas transition-colors"
            >
              Get Recommendations
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="px-8 py-3 bg-bk-ink text-bk-canvas font-barlow font-bold text-lg tracking-widest uppercase hover:bg-bk-lime hover:text-bk-ink transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
