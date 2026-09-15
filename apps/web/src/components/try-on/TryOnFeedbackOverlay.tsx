import React from "react";
import { Loader2, AlertCircle, ScanFace } from "lucide-react";
import {
  TryOnPrimaryState,
  TryOnTrackingState,
  TryOnStateError,
} from "../../hooks/use-try-on-state";

interface TryOnFeedbackOverlayProps {
  primaryState: TryOnPrimaryState;
  trackingState: TryOnTrackingState;
  error: TryOnStateError | null;
  onRetry: () => void;
  onReset: () => void;
}

export function TryOnFeedbackOverlay({
  primaryState,
  trackingState,
  error,
  onRetry,
  onReset,
}: TryOnFeedbackOverlayProps) {
  // 1. Error state
  if (primaryState === "error" && error) {
    const isPermissionError = error.type === "permission-denied";

    return (
      <div className="absolute inset-0 bg-bk-canvas/95 flex flex-col items-center justify-center p-6 text-center z-50">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="font-barlow font-bold text-xl text-bk-ink mb-2">
          {isPermissionError ? "CAMERA ACCESS DENIED" : "SOMETHING WENT WRONG"}
        </h3>
        <p className="font-inter text-sm text-bk-ink/80 mb-6">
          {error.message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onReset}
            className="px-6 py-3 font-barlow font-bold border-2 border-bk-ink text-bk-ink rounded-full hover:bg-bk-ink/5 transition-colors focus:outline-none focus:ring-4 focus:ring-bk-lime"
          >
            GO BACK
          </button>
          {!isPermissionError && (
            <button
              onClick={onRetry}
              className="px-6 py-3 font-barlow font-bold bg-bk-ink text-white rounded-full hover:bg-bk-ink/90 transition-colors focus:outline-none focus:ring-4 focus:ring-bk-lime"
            >
              TRY AGAIN
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. Loading states (permission-pending, initializing)
  if (
    primaryState === "permission-pending" ||
    primaryState === "initializing"
  ) {
    const message =
      primaryState === "permission-pending"
        ? "Waiting for camera permission..."
        : "Loading Virtual Try-On...";

    return (
      <div className="absolute inset-0 bg-bk-ink/80 backdrop-blur-sm flex flex-col items-center justify-center z-40 text-white">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-bk-lime" />
        <p className="font-barlow font-bold tracking-wide" aria-live="polite">
          {message}
        </p>
      </div>
    );
  }

  // 3. Tracking Feedback (running)
  if (primaryState === "running") {
    if (trackingState === "no-face") {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none">
          <div className="bg-bk-ink/70 backdrop-blur-sm p-6 rounded-2xl flex flex-col items-center">
            <ScanFace className="w-12 h-12 text-white/50 mb-3" />
            <p
              className="font-barlow font-bold text-white tracking-wide"
              aria-live="polite"
            >
              LOOKING FOR A FACE...
            </p>
          </div>
        </div>
      );
    }

    if (trackingState === "tracking-lost") {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none">
          <div className="bg-bk-ink/70 backdrop-blur-sm px-6 py-4 rounded-full border border-white/10">
            <p
              className="font-barlow font-bold text-bk-lime tracking-wide"
              aria-live="polite"
            >
              COME BACK INTO VIEW
            </p>
          </div>
        </div>
      );
    }
  }

  return null;
}
