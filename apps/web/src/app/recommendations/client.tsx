"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type {
  RecommendationResponseDto,
  RecommendedHairstyleDto,
} from "@barberkece/contracts";
import {
  FACE_SHAPES,
  HAIR_TYPES,
  HAIR_DENSITIES,
  HAIR_LENGTHS,
  MAINTENANCE_LEVELS,
} from "@barberkece/core/recommendation";

export function buildTransientPayload(searchParams: {
  get: (name: string) => string | null;
  getAll: (name: string) => string[];
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    mode: "transient",
  };

  const faceShape = searchParams.get("faceShape");
  if (faceShape && (FACE_SHAPES as readonly string[]).includes(faceShape)) {
    payload.faceShape = faceShape;
  }

  const hairType = searchParams.get("hairType");
  if (hairType && (HAIR_TYPES as readonly string[]).includes(hairType)) {
    payload.hairType = hairType;
  }

  const hairDensity = searchParams.get("hairDensity");
  if (
    hairDensity &&
    (HAIR_DENSITIES as readonly string[]).includes(hairDensity)
  ) {
    payload.hairDensity = hairDensity;
  }

  const hairLength = searchParams.get("hairLength");
  if (hairLength && (HAIR_LENGTHS as readonly string[]).includes(hairLength)) {
    payload.hairLength = hairLength;
  }

  const maintenance = searchParams.get("maintenance");
  if (
    maintenance &&
    (MAINTENANCE_LEVELS as readonly string[]).includes(maintenance)
  ) {
    payload.maintenance = maintenance;
  }

  const styleTags = searchParams.getAll("styleTags");
  if (styleTags.length > 0) {
    payload.styleTags = styleTags;
  }

  return payload;
}

export function hasUsableTransientFactors(
  payload: Record<string, unknown>,
): boolean {
  return (
    Boolean(payload.faceShape) ||
    Boolean(payload.hairType) ||
    Boolean(payload.hairDensity) ||
    Boolean(payload.hairLength) ||
    Boolean(payload.maintenance) ||
    (Array.isArray(payload.styleTags) && payload.styleTags.length > 0)
  );
}

export function parseRecommendationEnvelope(
  json: unknown,
): RecommendationResponseDto {
  if (
    !json ||
    typeof json !== "object" ||
    !("data" in json) ||
    !json.data ||
    typeof json.data !== "object"
  ) {
    throw new Error("Invalid recommendation response envelope");
  }

  const envelopeData = (json as { data: unknown }).data;
  if (
    !envelopeData ||
    typeof envelopeData !== "object" ||
    !("topMatches" in envelopeData) ||
    !Array.isArray((envelopeData as { topMatches: unknown }).topMatches) ||
    !("growOutOptions" in envelopeData) ||
    !Array.isArray((envelopeData as { growOutOptions: unknown }).growOutOptions)
  ) {
    throw new Error("Malformed recommendation response structure");
  }

  return envelopeData as RecommendationResponseDto;
}

export async function performRecommendationFetch(
  payload: Record<string, unknown>,
): Promise<RecommendationResponseDto> {
  const response = await fetch("/api/v1/recommendations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch recommendations");
  }

  const json = await response.json();
  return parseRecommendationEnvelope(json);
}

export interface RecommendationsClientProps {
  initialData?: RecommendationResponseDto | null;
  initialLoading?: boolean;
  initialError?: string | null;
  initialEmptyInput?: boolean;
  onRetry?: () => void;
}

export function RecommendationsClient({
  initialData = null,
  initialLoading = false,
  initialError = null,
  initialEmptyInput = false,
  onRetry,
}: RecommendationsClientProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const payload = buildTransientPayload(searchParams);
  const hasFactors = hasUsableTransientFactors(payload);
  const isEmptyInput =
    initialEmptyInput ||
    (!initialData && !initialError && !initialLoading && !hasFactors);

  const isControlled =
    initialData !== null ||
    initialError !== null ||
    initialLoading ||
    initialEmptyInput;
  const [data, setData] = useState<RecommendationResponseDto | null>(
    initialData,
  );
  const [loading, setLoading] = useState<boolean>(
    isControlled ? initialLoading : hasFactors ? true : false,
  );
  const [error, setError] = useState<string | null>(initialError);

  const handleRetry = async () => {
    if (!hasFactors) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await performRecommendationFetch(payload);
      setData(result);
    } catch {
      setError(
        "Something went wrong loading your recommendations. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialData || initialError || initialEmptyInput || !hasFactors) return;

    let isCancelled = false;

    const executeFetch = async () => {
      try {
        const fetchPayload = buildTransientPayload(searchParams);
        const result = await performRecommendationFetch(fetchPayload);
        if (!isCancelled) {
          setData(result);
        }
      } catch {
        if (!isCancelled) {
          setError(
            "Something went wrong loading your recommendations. Please try again.",
          );
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void executeFetch();

    return () => {
      isCancelled = true;
    };
  }, [searchParams, initialData, initialError, initialEmptyInput, hasFactors]);

  if (isEmptyInput) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <h2 className="text-3xl font-barlow font-bold uppercase mb-4">
          No Profile Selected
        </h2>
        <p className="text-neutral-600 mb-8 max-w-md mx-auto">
          We need to know a little about your hair to recommend the best styles.
          Please complete the quick quiz to find your style.
        </p>
        <button
          onClick={() => router.push("/find-my-style")}
          className="px-6 py-3 bg-bk-lime text-bk-ink font-barlow font-bold uppercase tracking-widest hover:bg-bk-ink hover:text-bk-lime transition-colors"
        >
          Take the Quiz
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-bk-ink">
        <div className="w-16 h-16 border-4 border-neutral-200 border-t-bk-lime rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-barlow font-bold uppercase tracking-widest animate-pulse">
          Analyzing Profile...
        </h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="bg-red-50 text-red-600 p-6 rounded-lg max-w-lg w-full border border-red-200 shadow-sm">
          <h2 className="text-2xl font-barlow font-bold mb-2 uppercase">
            Error
          </h2>
          <p className="mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                if (onRetry) {
                  onRetry();
                } else {
                  void handleRetry();
                }
              }}
              className="px-6 py-2 bg-bk-ink text-white font-barlow font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/find-my-style")}
              className="px-6 py-2 border-2 border-bk-ink font-barlow font-bold uppercase tracking-widest text-bk-ink hover:bg-neutral-100 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.topMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <h2 className="text-3xl font-barlow font-bold uppercase mb-4">
          No Matches Found
        </h2>
        <p className="text-neutral-600 mb-8 max-w-md mx-auto">
          We couldn&apos;t find a perfect style matching all your exact
          criteria. Try adjusting your preferences.
        </p>
        <button
          onClick={() => router.push("/find-my-style")}
          className="px-6 py-3 bg-bk-lime text-bk-ink font-barlow font-bold uppercase tracking-widest hover:bg-bk-ink hover:text-bk-lime transition-colors"
        >
          Adjust Preferences
        </button>
      </div>
    );
  }

  const topMatch = data.topMatches[0];
  const otherMatches = data.topMatches.slice(1);
  const growOutOptions = data.growOutOptions;

  return (
    <div className="animate-in fade-in duration-700">
      <header className="mb-8 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-neutral-500 font-barlow font-medium tracking-widest uppercase mb-2">
            Your Results
          </p>
          <h1 className="text-4xl md:text-6xl font-barlow font-bold text-bk-ink uppercase tracking-tight">
            Curated For <span className="bg-bk-lime px-2">You</span>
          </h1>
        </div>
        <button
          onClick={() => router.push("/find-my-style")}
          className="px-6 py-2 border-2 border-bk-ink font-barlow font-bold uppercase tracking-widest text-bk-ink hover:bg-bk-ink hover:text-bk-canvas transition-colors w-fit"
        >
          Retake Quiz
        </button>
      </header>

      {/* Desktop Split Hero for #1 Match */}
      <section className="mb-16">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-bk-ink text-bk-lime flex items-center justify-center rounded-full font-barlow font-bold text-2xl">
            #1
          </div>
          <h2 className="text-3xl font-barlow font-bold text-bk-ink uppercase tracking-wider">
            Top Recommendation
          </h2>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-neutral-100 flex flex-col lg:flex-row">
          {/* Visual Side */}
          <div className="lg:w-1/2 bg-neutral-100 relative min-h-[300px] lg:min-h-[500px]">
            {topMatch.previewImageUrl ? (
              <img
                src={topMatch.previewImageUrl}
                alt={topMatch.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-800 text-neutral-400 font-barlow uppercase tracking-widest">
                No Preview Available
              </div>
            )}
            <div className="absolute top-4 right-4 bg-bk-lime text-bk-ink px-4 py-1 rounded-full font-bold font-barlow tracking-wider shadow-md">
              {Math.round(topMatch.matchPercentage * 100)}% Match
            </div>
          </div>

          {/* Content Side */}
          <div className="lg:w-1/2 p-6 md:p-10 lg:p-12 flex flex-col justify-center">
            <h3 className="text-4xl lg:text-5xl font-barlow font-bold text-bk-ink uppercase mb-2">
              {topMatch.name}
            </h3>
            <p className="text-lg text-neutral-600 mb-8 font-medium">
              {topMatch.shortDescription}
            </p>

            <div className="space-y-6 mb-8">
              <div>
                <h4 className="font-barlow font-bold text-bk-ink uppercase tracking-wider border-b border-neutral-200 pb-2 mb-3">
                  Why it works for you
                </h4>
                <ul className="space-y-2">
                  {topMatch.reasons.map((reason: string, i: number) => (
                    <li key={i} className="flex gap-3 text-neutral-700">
                      <span className="text-bk-lime font-bold">✓</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {topMatch.cautions && topMatch.cautions.length > 0 && (
                <div>
                  <h4 className="font-barlow font-bold text-bk-ink uppercase tracking-wider border-b border-neutral-200 pb-2 mb-3">
                    Things to consider
                  </h4>
                  <ul className="space-y-2">
                    {topMatch.cautions.map((caution: string, i: number) => (
                      <li key={i} className="flex gap-3 text-neutral-700">
                        <span className="text-amber-500 font-bold">!</span>
                        <span>{caution}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Other Matches Grid */}
      {otherMatches.length > 0 && (
        <section className="mb-16">
          <h2 className="text-3xl font-barlow font-bold text-bk-ink uppercase tracking-wider mb-8 flex items-center gap-3">
            <span className="w-8 h-8 bg-neutral-200 text-bk-ink flex items-center justify-center rounded-full text-sm">
              {otherMatches.length}
            </span>
            Great Alternatives
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherMatches.map((match: RecommendedHairstyleDto, idx: number) => (
              <HairstyleCard key={match.id} match={match} rank={idx + 2} />
            ))}
          </div>
        </section>
      )}

      {/* Grow Out Options */}
      {growOutOptions && growOutOptions.length > 0 && (
        <section className="mb-16 pt-16 border-t-2 border-neutral-200 border-dashed">
          <div className="mb-8">
            <h2 className="text-3xl font-barlow font-bold text-bk-ink uppercase tracking-wider mb-2">
              Future Goals
            </h2>
            <p className="text-neutral-600 max-w-2xl">
              These styles require more length than you currently have, but
              would suit your face shape and hair type perfectly. Start growing
              it out!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {growOutOptions.map((match: RecommendedHairstyleDto) => (
              <HairstyleCard key={match.id} match={match} isGrowOut />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function HairstyleCard({
  match,
  rank,
  isGrowOut = false,
}: {
  match: RecommendedHairstyleDto;
  rank?: number;
  isGrowOut?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-md border border-neutral-100 flex flex-col h-full group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="h-48 relative bg-neutral-100 overflow-hidden">
        {match.previewImageUrl ? (
          <img
            src={match.previewImageUrl}
            alt={match.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-800 text-neutral-400 font-barlow uppercase text-sm tracking-widest">
            No Preview
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {!isGrowOut && rank && (
            <div className="w-8 h-8 bg-bk-ink text-bk-lime flex items-center justify-center rounded-full font-barlow font-bold text-sm shadow-md">
              #{rank}
            </div>
          )}
        </div>

        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur text-bk-ink px-3 py-1 rounded-full font-bold font-barlow text-sm tracking-wider shadow-sm">
          {Math.round(match.matchPercentage * 100)}% Match
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-2xl font-barlow font-bold text-bk-ink uppercase mb-1">
          {match.name}
        </h3>
        <p className="text-sm text-neutral-600 mb-4 line-clamp-2 h-10">
          {match.shortDescription}
        </p>

        <div className="mt-auto">
          {match.reasons.length > 0 && (
            <p className="text-sm text-neutral-700 flex items-start gap-2">
              <span className="text-bk-lime font-bold mt-0.5">✓</span>
              <span className="line-clamp-2 text-xs font-medium leading-snug">
                {match.reasons[0]}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
