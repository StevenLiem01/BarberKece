import { useState, useCallback, useRef, useEffect } from "react";
import {
  TryOnController,
  TryOnPrimaryState,
  TryOnTrackingState,
  TryOnErrorType,
  TryOnStateError,
} from "../lib/cv/try-on-controller";
import { MediaPipeFaceTracker } from "../lib/cv/mediapipe-tracker";
import { FacingMode } from "../lib/cv/camera-controller";

export type {
  TryOnPrimaryState,
  TryOnTrackingState,
  TryOnErrorType,
  TryOnStateError,
};

export function useTryOnState(customController?: TryOnController) {
  const [primaryState, setPrimaryState] = useState<TryOnPrimaryState>("idle");
  const [trackingState, setTrackingState] =
    useState<TryOnTrackingState>("no-face");
  const [error, setError] = useState<TryOnStateError | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [tracker, setTracker] = useState<MediaPipeFaceTracker | null>(null);
  const [canFlip, setCanFlip] = useState(false);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");

  const controllerRef = useRef<TryOnController | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current =
      customController ??
      new TryOnController({
        onStateChange: (s) => setPrimaryState(s),
        onTrackingStateChange: (t) => setTrackingState(t),
        onErrorChange: (err) => setError(err),
        onStreamChange: (st) => setStream(st),
        onTrackerChange: (tr) => setTracker(tr),
        onCanFlipChange: (cf) => setCanFlip(cf),
        onFacingModeChange: (fm) => setFacingMode(fm),
      });
  }

  const isRunning = primaryState === "running" && !!stream && !!tracker;

  const handleStart = useCallback(async () => {
    await controllerRef.current?.start();
  }, []);

  const handleStop = useCallback(() => {
    controllerRef.current?.stop();
  }, []);

  const handleRetry = useCallback(async () => {
    await controllerRef.current?.retry();
  }, []);

  const handleReset = useCallback(() => {
    controllerRef.current?.reset();
  }, []);

  const handleToggleFacingMode = useCallback(async () => {
    return controllerRef.current?.toggleFacingMode();
  }, []);

  const handleTrackingStatusChange = useCallback(
    (status: "detected" | "lost") => {
      controllerRef.current?.onTrackingStatusChange(status);
    },
    [],
  );

  useEffect(() => {
    const controller = controllerRef.current;
    return () => {
      controller?.dispose();
    };
  }, []);

  return {
    stream,
    tracker,
    primaryState,
    trackingState,
    error,
    isRunning,
    facingMode,
    canFlip,
    start: handleStart,
    stop: handleStop,
    retry: handleRetry,
    reset: handleReset,
    toggleFacingMode: handleToggleFacingMode,
    handleTrackingStatusChange,
  };
}
