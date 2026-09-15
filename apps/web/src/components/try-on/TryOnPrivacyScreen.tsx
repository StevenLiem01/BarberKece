import React from "react";
import { Camera, ShieldCheck } from "lucide-react";

interface TryOnPrivacyScreenProps {
  onAccept: () => void;
  isInitializing: boolean;
}

export function TryOnPrivacyScreen({
  onAccept,
  isInitializing,
}: TryOnPrivacyScreenProps) {
  return (
    <div className="absolute inset-0 bg-bk-canvas flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
        <Camera className="w-8 h-8 text-bk-ink" />
      </div>

      <h2 className="text-2xl font-barlow font-bold text-bk-ink mb-4">
        VIRTUAL HAIRSTYLE FILTER
      </h2>

      <p className="text-bk-ink/80 font-inter text-sm max-w-sm mb-8 leading-relaxed">
        See how our hairstyles look on you in real-time.
      </p>

      <div className="bg-white p-4 rounded-xl shadow-sm text-left w-full max-w-sm mb-8">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-bk-lime shrink-0 mt-0.5" />
          <div>
            <h3 className="font-barlow font-bold text-bk-ink text-lg leading-tight mb-1">
              PRIVACY FIRST
            </h3>
            <p className="font-inter text-xs text-bk-ink/70 leading-normal">
              All camera processing happens locally on your device. We never
              upload or save your video feed without explicit permission.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onAccept}
        disabled={isInitializing}
        className="w-full max-w-sm bg-bk-ink text-bk-canvas font-barlow font-bold text-xl py-4 px-6 rounded-full hover:bg-bk-ink/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-4 focus:ring-bk-lime"
        aria-label="Enable camera for Virtual Try-On"
      >
        {isInitializing ? "LOADING..." : "ENABLE CAMERA"}
      </button>
    </div>
  );
}
