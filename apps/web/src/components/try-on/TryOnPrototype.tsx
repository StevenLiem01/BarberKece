"use client";

import React, { useEffect, useRef, useState } from "react";
import { useCamera } from "../../hooks/use-camera";
import { useTryOnLoop } from "../../hooks/use-try-on-loop";
import { MediaPipeFaceTracker } from "../../lib/cv/mediapipe-tracker";
import { AssetCalibration } from "@barberkece/core/try-on";

const DUMMY_CALIBRATION: AssetCalibration = {
  baselineWidth: 200,
  baselineHeight: 200,
  // Align center of the asset to the anchor
  anchorOffsetX: 0,
  anchorOffsetY: 0,
};

export function TryOnPrototype() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { stream, error, isInitializing, startCamera, stopCamera } =
    useCamera();
  const [tracker, setTracker] = useState<MediaPipeFaceTracker | null>(null);
  const [dummyAsset, setDummyAsset] = useState<HTMLImageElement | null>(null);

  // Load asset
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

  // Handle start
  const handleStart = async () => {
    try {
      // 1. Initialize tracker if not already done
      if (!tracker) {
        const newTracker = new MediaPipeFaceTracker();
        await newTracker.initialize();
        setTracker(newTracker);
      }

      // 2. Start Camera
      await startCamera("user");
    } catch (err) {
      console.error("Failed to start TryOn", err);
    }
  };

  const handleStop = () => {
    stopCamera();
    if (tracker) {
      tracker.close();
      setTracker(null);
    }
  };

  // Teardown on unmount
  useEffect(() => {
    return () => {
      if (tracker) {
        tracker.close();
      }
    };
  }, [tracker]);

  const isActive = !!(stream && tracker);

  useTryOnLoop({
    videoRef,
    canvasRef,
    tracker,
    isActive,
    dummyAsset,
    calibration: DUMMY_CALIBRATION,
  });

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <h1 className="text-xl font-bold">Virtual Try-On Prototype</h1>

      {error && (
        <div className="bg-red-100 text-red-800 p-2 rounded">
          {error.message}
        </div>
      )}

      <div className="flex gap-4">
        {!isActive ? (
          <button
            onClick={handleStart}
            disabled={isInitializing}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {isInitializing ? "Starting..." : "Enable Camera"}
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="px-4 py-2 bg-red-600 text-white rounded"
          >
            Stop Camera
          </button>
        )}
      </div>

      <div className="relative w-full max-w-[400px] aspect-[3/4] bg-slate-100 rounded overflow-hidden">
        <video ref={videoRef} className="hidden" playsInline autoPlay muted />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            Camera Off
          </div>
        )}
      </div>
    </div>
  );
}
