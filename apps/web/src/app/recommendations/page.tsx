import { Suspense } from "react";
import { RecommendationsClient } from "./client";

export default function RecommendationsPage() {
  return (
    <main className="min-h-screen bg-bk-canvas py-12 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-bk-ink">
              <div className="w-16 h-16 border-4 border-neutral-200 border-t-bk-lime rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl font-barlow font-bold uppercase tracking-widest animate-pulse">
                Loading Profile...
              </h2>
            </div>
          }
        >
          <RecommendationsClient />
        </Suspense>
      </div>
    </main>
  );
}
