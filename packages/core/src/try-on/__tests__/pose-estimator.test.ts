import { describe, expect, it } from "vitest";
import { extractPose } from "../pose-estimator.js";
import { LandmarkMap, NormalizedLandmark } from "../types.js";

describe("PoseEstimator", () => {
  const map: LandmarkMap = {
    leftEye: 0,
    rightEye: 1,
  };

  it("calculates neutral pose correctly", () => {
    // leftEye at (0.45, 0.5), rightEye at (0.55, 0.5)
    // dx = 0.1, dy = 0.0 -> roll = 0
    // distance = 0.1 -> scale = 1.0 (since NEUTRAL_EYE_DISTANCE = 0.1)
    const landmarks: NormalizedLandmark[] = [
      { x: 0.45, y: 0.5 },
      { x: 0.55, y: 0.5 },
    ];

    const pose = extractPose(landmarks, map);
    expect(pose).not.toBeNull();
    expect(pose?.anchor).toEqual({ x: 0.5, y: 0.5 });
    expect(pose?.roll).toBeCloseTo(0);
    expect(pose?.scale).toBeCloseTo(1.0);
  });

  it("calculates scaled pose correctly", () => {
    // leftEye at (0.4, 0.5), rightEye at (0.6, 0.5)
    // distance = 0.2 -> scale = 2.0
    const landmarks: NormalizedLandmark[] = [
      { x: 0.4, y: 0.5 },
      { x: 0.6, y: 0.5 },
    ];

    const pose = extractPose(landmarks, map);
    expect(pose).not.toBeNull();
    expect(pose?.anchor).toEqual({ x: 0.5, y: 0.5 });
    expect(pose?.roll).toBeCloseTo(0);
    expect(pose?.scale).toBeCloseTo(2.0);
  });

  it("calculates positive roll correctly", () => {
    // Tilted face: leftEye is higher (smaller y), rightEye is lower (larger y)
    // dx = 0.1, dy = 0.1 -> angle is Math.PI / 4 (45 degrees)
    const landmarks: NormalizedLandmark[] = [
      { x: 0.45, y: 0.45 },
      { x: 0.55, y: 0.55 },
    ];

    const pose = extractPose(landmarks, map);
    expect(pose).not.toBeNull();
    expect(pose?.anchor).toEqual({ x: 0.5, y: 0.5 });
    expect(pose?.roll).toBeCloseTo(Math.PI / 4);
    // distance = sqrt(0.1^2 + 0.1^2) = 0.1414 -> scale = 1.414
    expect(pose?.scale).toBeCloseTo(Math.SQRT2);
  });

  it("calculates negative roll correctly", () => {
    // Tilted face: leftEye is lower (larger y), rightEye is higher (smaller y)
    // dx = 0.1, dy = -0.1 -> angle is -Math.PI / 4
    const landmarks: NormalizedLandmark[] = [
      { x: 0.45, y: 0.55 },
      { x: 0.55, y: 0.45 },
    ];

    const pose = extractPose(landmarks, map);
    expect(pose).not.toBeNull();
    expect(pose?.anchor).toEqual({ x: 0.5, y: 0.5 });
    expect(pose?.roll).toBeCloseTo(-Math.PI / 4);
    expect(pose?.scale).toBeCloseTo(Math.SQRT2);
  });

  it("returns null if landmarks array is empty", () => {
    const pose = extractPose([], map);
    expect(pose).toBeNull();
  });

  it("returns null if required landmarks are missing", () => {
    // Map requires indices 0 and 1, but we only provide 0
    const landmarks: NormalizedLandmark[] = [{ x: 0.45, y: 0.5 }];
    const pose = extractPose(landmarks, map);
    expect(pose).toBeNull();
  });

  it("handles z-coordinates if present", () => {
    const landmarks: NormalizedLandmark[] = [
      { x: 0.45, y: 0.5, z: 0.1 },
      { x: 0.55, y: 0.5, z: 0.2 },
    ];

    const pose = extractPose(landmarks, map);
    expect(pose).not.toBeNull();
    expect(pose?.anchor.z).toBeCloseTo(0.15);
  });

  it("returns null if landmark coordinates contain NaN", () => {
    const landmarksWithNanX: NormalizedLandmark[] = [
      { x: Number.NaN, y: 0.5 },
      { x: 0.55, y: 0.5 },
    ];
    expect(extractPose(landmarksWithNanX, map)).toBeNull();

    const landmarksWithNanY: NormalizedLandmark[] = [
      { x: 0.45, y: 0.5 },
      { x: 0.55, y: Number.NaN },
    ];
    expect(extractPose(landmarksWithNanY, map)).toBeNull();
  });

  it("returns null if landmark coordinates contain ±Infinity", () => {
    const landmarksWithPosInf: NormalizedLandmark[] = [
      { x: Number.POSITIVE_INFINITY, y: 0.5 },
      { x: 0.55, y: 0.5 },
    ];
    expect(extractPose(landmarksWithPosInf, map)).toBeNull();

    const landmarksWithNegInf: NormalizedLandmark[] = [
      { x: 0.45, y: 0.5 },
      { x: 0.55, y: Number.NEGATIVE_INFINITY },
    ];
    expect(extractPose(landmarksWithNegInf, map)).toBeNull();
  });

  it("returns null if optional z coordinate is non-finite", () => {
    const landmarksWithNanZ: NormalizedLandmark[] = [
      { x: 0.45, y: 0.5, z: Number.NaN },
      { x: 0.55, y: 0.5, z: 0.2 },
    ];
    expect(extractPose(landmarksWithNanZ, map)).toBeNull();

    const landmarksWithInfZ: NormalizedLandmark[] = [
      { x: 0.45, y: 0.5, z: 0.1 },
      { x: 0.55, y: 0.5, z: Number.POSITIVE_INFINITY },
    ];
    expect(extractPose(landmarksWithInfZ, map)).toBeNull();
  });

  it("returns null if eye landmarks are coincident (degenerate zero distance)", () => {
    const coincidentLandmarks: NormalizedLandmark[] = [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ];
    expect(extractPose(coincidentLandmarks, map)).toBeNull();
  });

  it("returns null for invalid landmark map indices", () => {
    const landmarks: NormalizedLandmark[] = [
      { x: 0.45, y: 0.5 },
      { x: 0.55, y: 0.5 },
    ];
    expect(
      extractPose(landmarks, {
        leftEye: Number.NaN,
        rightEye: 1,
      } as unknown as LandmarkMap),
    ).toBeNull();
    expect(
      extractPose(landmarks, {
        leftEye: 0,
        rightEye: 1.5,
      } as unknown as LandmarkMap),
    ).toBeNull();
  });

  it("is mathematically repeatable for identical inputs", () => {
    const landmarks: NormalizedLandmark[] = [
      { x: 0.43, y: 0.48 },
      { x: 0.57, y: 0.52 },
    ];

    const pose1 = extractPose(landmarks, map);
    const pose2 = extractPose(landmarks, map);

    expect(pose1).toEqual(pose2);
  });
});
