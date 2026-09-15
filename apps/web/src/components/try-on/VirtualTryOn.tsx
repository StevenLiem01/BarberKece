"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTryOnState } from "../../hooks/use-try-on-state";
import { useTryOnLoop } from "../../hooks/use-try-on-loop";
import { AssetCalibration } from "@barberkece/core/try-on";

import { TryOnPrivacyScreen } from "./TryOnPrivacyScreen";
import { TryOnControls } from "./TryOnControls";
import { TryOnFeedbackOverlay } from "./TryOnFeedbackOverlay";

const DUMMY_CALIBRATION: AssetCalibration = {
  baselineWidth: 200,
  baselineHeight: 200,
  // Align center of the asset to the anchor
  anchorOffsetX: 0,
  anchorOffsetY: 0,
};

export function VirtualTryOn() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    stream,
    tracker,
    primaryState,
    trackingState,
    error,
    isRunning,
    start,
    stop,
    retry,
    reset,
    toggleFacingMode,
    canFlip,
    handleTrackingStatusChange,
  } = useTryOnState();

  const [dummyAsset, setDummyAsset] = useState<HTMLImageElement | null>(null);

  // Load dummy asset
  useEffect(() => {
    const img = new Image();
    img.src = "/images/dummy-hairstyle.png";
    img.onload = () => setDummyAsset(img);
  }, []);

  // Sync stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Teardown on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  useTryOnLoop({
    videoRef,
    canvasRef,
    tracker,
    isActive: isRunning,
    dummyAsset,
    calibration: DUMMY_CALIBRATION,
    onTrackingStatusChange: handleTrackingStatusChange,
  });

  return (
    <div className="relative w-full max-w-[400px] aspect-[3/4] sm:aspect-[9/16] bg-bk-ink rounded-2xl overflow-hidden shadow-2xl mx-auto flex flex-col">
      {/* 1. Privacy / Idle Screen */}
      {primaryState === "idle" && (
        <TryOnPrivacyScreen onAccept={start} isInitializing={false} />
      )}

      {/* 2. Video / Canvas Container */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        autoPlay
        muted
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          primaryState === "running" ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* 3. Feedback Overlay (Loading, Error, Looking for face) */}
      <TryOnFeedbackOverlay
        primaryState={primaryState}
        trackingState={trackingState}
        error={error}
        onRetry={retry}
        onReset={reset}
      />

      {/* 4. Controls (only visible when running or initializing, unless error) */}
      {(primaryState === "running" || primaryState === "initializing") && (
        <TryOnControls
          onStop={stop}
          onFlip={toggleFacingMode}
          canFlip={canFlip}
          hairstyleName="Dummy Hairstyle"
        />
      )}
    </div>
  );
}
