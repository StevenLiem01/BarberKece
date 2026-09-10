import React from "react";
import { CheckIcon } from "@/components/ui/icons";

export interface StepIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  canNavigateToStep?: (step: number) => boolean;
}

const STEPS = [
  { step: 1, label: "Layanan" },
  { step: 2, label: "Barber" },
  { step: 3, label: "Tanggal" },
  { step: 4, label: "Waktu" },
  { step: 5, label: "Ringkasan" },
];

export function StepIndicator({
  currentStep,
  onStepClick,
  canNavigateToStep,
}: StepIndicatorProps) {
  return (
    <nav aria-label="Tahapan Reservasi" className="w-full">
      <ol className="flex items-center justify-between gap-1 sm:gap-2">
        {STEPS.map(({ step, label }, idx) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          const isClickable =
            onStepClick && canNavigateToStep && canNavigateToStep(step);

          return (
            <React.Fragment key={step}>
              <li className="flex flex-1 flex-col items-center">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick(step)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`group flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9F23B] rounded-md transition-colors ${
                    isClickable ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isCurrent
                        ? "bg-[#11110F] text-[#FAF8F3] ring-2 ring-[#C9F23B]"
                        : isCompleted
                          ? "bg-[#2F7D4A] text-[#FAF8F3]"
                          : "bg-[#FAF8F3] text-[#6E6C65] border border-[#D8D4CA]"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckIcon size={14} className="stroke-[3]" />
                    ) : (
                      step
                    )}
                  </span>
                  <span
                    className={`hidden sm:inline text-xs font-medium ${
                      isCurrent
                        ? "text-[#11110F] font-bold"
                        : isCompleted
                          ? "text-[#22231F]"
                          : "text-[#6E6C65]"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              </li>

              {idx < STEPS.length - 1 && (
                <li
                  aria-hidden="true"
                  className={`h-0.5 flex-1 transition-colors ${
                    step < currentStep ? "bg-[#2F7D4A]" : "bg-[#D8D4CA]"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
