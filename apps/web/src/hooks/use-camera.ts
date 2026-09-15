import { useState, useCallback, useRef, useEffect } from "react";
import { CameraController, FacingMode } from "../lib/cv/camera-controller";

export type { FacingMode };

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [error, setError] = useState<Error | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const controllerRef = useRef<CameraController | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current = new CameraController({
      onStreamChange: (s) => setStream(s),
      onError: (err) => setError(err),
      onLoadingChange: (loading) => setIsInitializing(loading),
      onFacingModeChange: (mode) => setFacingMode(mode),
    });
  }

  const startCamera = useCallback(async (mode: FacingMode = "user") => {
    return controllerRef.current?.start(mode);
  }, []);

  const stopCamera = useCallback(() => {
    controllerRef.current?.stop();
  }, []);

  const toggleFacingMode = useCallback(async () => {
    return controllerRef.current?.toggleFacingMode();
  }, []);

  // Ensure camera shuts off and ongoing requests are aborted when component unmounts
  useEffect(() => {
    const controller = controllerRef.current;
    return () => {
      controller?.dispose();
    };
  }, []);

  return {
    stream,
    facingMode,
    error,
    isInitializing,
    startCamera,
    stopCamera,
    toggleFacingMode,
  };
}
