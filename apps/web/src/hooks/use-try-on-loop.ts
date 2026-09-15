import { useEffect, useRef } from "react";
import { MediaPipeFaceTracker } from "../lib/cv/mediapipe-tracker";
import {
  extractPose,
  solveTransform,
  AssetCalibration,
} from "@barberkece/core/try-on";
import { MEDIA_PIPE_LANDMARK_MAP } from "../lib/cv/landmark-map";

interface UseTryOnLoopProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  tracker: MediaPipeFaceTracker | null;
  isActive: boolean;
  dummyAsset: HTMLImageElement | null;
  calibration: AssetCalibration;
}

export function useTryOnLoop({
  videoRef,
  canvasRef,
  tracker,
  isActive,
  dummyAsset,
  calibration,
}: UseTryOnLoopProps) {
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (
      !isActive ||
      !tracker ||
      !videoRef.current ||
      !canvasRef.current ||
      !dummyAsset
    ) {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const loop = (timestamp: number) => {
      // Keep canvas size synced with video
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        if (
          canvas.width !== video.videoWidth ||
          canvas.height !== video.videoHeight
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
      }

      const cw = canvas.width;
      const ch = canvas.height;

      // Draw video frame
      if (video.readyState >= 2 && cw > 0 && ch > 0) {
        ctx.clearRect(0, 0, cw, ch);

        // Handle mirroring for user facing camera
        ctx.save();
        ctx.translate(cw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, cw, ch);
        ctx.restore();

        // Run tracking
        const result = tracker.detectForVideo(video, timestamp);
        if (result && result.landmarks) {
          const pose = extractPose(result.landmarks, MEDIA_PIPE_LANDMARK_MAP);

          if (pose) {
            // Since we mirrored the video drawing, we need to apply mirroring to the pose anchor
            pose.anchor.x = 1 - pose.anchor.x;
            // Roll needs to be inverted for mirrored view
            pose.roll = -pose.roll;

            const transform = solveTransform(pose, calibration, cw, ch);
            if (transform) {
              ctx.save();
              ctx.translate(transform.translationX, transform.translationY);
              // Translate to center of asset to rotate and scale
              const scaledWidth = calibration.baselineWidth * transform.scale;
              const scaledHeight = calibration.baselineHeight * transform.scale;
              ctx.translate(scaledWidth / 2, scaledHeight / 2);
              ctx.rotate(transform.rotation);
              ctx.translate(-scaledWidth / 2, -scaledHeight / 2);

              ctx.drawImage(dummyAsset, 0, 0, scaledWidth, scaledHeight);
              ctx.restore();
            }
          }
        }
      }

      rafId.current = requestAnimationFrame(loop);
    };

    rafId.current = requestAnimationFrame(loop);

    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [isActive, tracker, videoRef, canvasRef, dummyAsset, calibration]);
}
