import React from "react";
import { RefreshCw, X } from "lucide-react";

interface TryOnControlsProps {
  onStop: () => void;
  onFlip: () => void;
  canFlip: boolean;
  hairstyleName?: string;
}

export function TryOnControls({
  onStop,
  onFlip,
  canFlip,
  hairstyleName = "Dummy Hairstyle",
}: TryOnControlsProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
      {/* Top bar */}
      <div className="flex justify-between items-start">
        <div className="bg-bk-ink/80 backdrop-blur-sm text-bk-lime font-barlow font-bold px-3 py-1.5 rounded-full text-sm">
          {hairstyleName.toUpperCase()}
        </div>

        <button
          onClick={onStop}
          className="pointer-events-auto bg-bk-ink/50 backdrop-blur-md text-white p-2 rounded-full hover:bg-bk-ink/70 transition-colors focus:outline-none focus:ring-2 focus:ring-bk-lime"
          aria-label="Stop Camera"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom controls */}
      <div className="flex justify-end">
        {canFlip && (
          <button
            onClick={onFlip}
            className="pointer-events-auto bg-bk-ink text-white p-4 rounded-full shadow-lg hover:bg-bk-ink/90 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-bk-lime"
            aria-label="Flip Camera"
          >
            <RefreshCw className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
}
