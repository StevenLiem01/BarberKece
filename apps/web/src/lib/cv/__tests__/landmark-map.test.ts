import { describe, it, expect } from "vitest";
import { MEDIA_PIPE_LANDMARK_MAP } from "../landmark-map";
import { extractPose, NormalizedLandmark } from "@barberkece/core/try-on";

describe("MEDIA_PIPE_LANDMARK_MAP", () => {
  it("defines distinct, positive integer indices for bilateral superior eye landmarks", () => {
    expect(Number.isInteger(MEDIA_PIPE_LANDMARK_MAP.leftEye)).toBe(true);
    expect(Number.isInteger(MEDIA_PIPE_LANDMARK_MAP.rightEye)).toBe(true);

    expect(MEDIA_PIPE_LANDMARK_MAP.leftEye).toBe(159);
    expect(MEDIA_PIPE_LANDMARK_MAP.rightEye).toBe(386);
    expect(MEDIA_PIPE_LANDMARK_MAP.leftEye).not.toBe(
      MEDIA_PIPE_LANDMARK_MAP.rightEye,
    );
  });

  it("integrates with M6-01 extractPose to derive anchor, roll, and scale", () => {
    // Create an array of 468 dummy landmarks
    const landmarks: NormalizedLandmark[] = Array.from({ length: 468 }, () => ({
      x: 0,
      y: 0,
      z: 0,
    }));

    // Place left eye (159) and right eye (386) at horizontal coordinates
    landmarks[MEDIA_PIPE_LANDMARK_MAP.leftEye] = { x: 0.4, y: 0.35, z: 0 };
    landmarks[MEDIA_PIPE_LANDMARK_MAP.rightEye] = { x: 0.6, y: 0.35, z: 0 };

    const pose = extractPose(landmarks, MEDIA_PIPE_LANDMARK_MAP);

    expect(pose).not.toBeNull();
    // Anchor should be exact midpoint: (0.5, 0.35)
    expect(pose?.anchor.x).toBeCloseTo(0.5);
    expect(pose?.anchor.y).toBeCloseTo(0.35);

    // Roll angle should be 0 radians (level horizontal eyes)
    expect(pose?.roll).toBeCloseTo(0);

    // Distance is 0.2, baseline is 0.1 => scale = 2.0
    expect(pose?.scale).toBeCloseTo(2.0);
  });
});
