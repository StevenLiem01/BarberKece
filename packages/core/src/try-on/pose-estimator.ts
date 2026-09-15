import { LandmarkMap, NormalizedLandmark, Pose } from "./types.js";

/**
 * Extracts a Pose from a raw list of landmarks using the provided LandmarkMap.
 *
 * @param landmarks The raw array of landmarks (e.g. from FaceTracker result)
 * @param map Semantic mapping of indices
 * @returns The computed Pose, or null if required landmarks are missing/invalid.
 */
export function extractPose(
  landmarks: NormalizedLandmark[],
  map: LandmarkMap,
): Pose | null {
  if (!landmarks || landmarks.length === 0 || !map) {
    return null;
  }

  if (!Number.isInteger(map.leftEye) || !Number.isInteger(map.rightEye)) {
    return null;
  }

  const leftEye = landmarks[map.leftEye];
  const rightEye = landmarks[map.rightEye];

  if (!leftEye || !rightEye) {
    return null; // Required landmarks missing
  }

  // Validate that required coordinates are finite numbers
  if (
    !Number.isFinite(leftEye.x) ||
    !Number.isFinite(leftEye.y) ||
    !Number.isFinite(rightEye.x) ||
    !Number.isFinite(rightEye.y)
  ) {
    return null;
  }

  // Validate optional z coordinates if present
  if (leftEye.z !== undefined && !Number.isFinite(leftEye.z)) {
    return null;
  }
  if (rightEye.z !== undefined && !Number.isFinite(rightEye.z)) {
    return null;
  }

  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;

  // Eye distance must be strictly finite and positive (rejects coincident/collapsed landmarks)
  const eyeDistance = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(eyeDistance) || eyeDistance <= 0) {
    return null;
  }

  // Neutral eye distance constant (purely an arbitrary standard for this solver).
  // If eyeDistance is 0.1, scale is 1.0. If eyeDistance is 0.2, scale is 2.0.
  const NEUTRAL_EYE_DISTANCE = 0.1;
  const scale = eyeDistance / NEUTRAL_EYE_DISTANCE;
  if (!Number.isFinite(scale) || scale <= 0) {
    return null;
  }

  const roll = Math.atan2(dy, dx);
  if (!Number.isFinite(roll)) {
    return null;
  }

  // Calculate anchor point (midpoint between left and right eye)
  const anchor: NormalizedLandmark = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };

  if (leftEye.z !== undefined && rightEye.z !== undefined) {
    anchor.z = (leftEye.z + rightEye.z) / 2;
  }

  if (
    !Number.isFinite(anchor.x) ||
    !Number.isFinite(anchor.y) ||
    (anchor.z !== undefined && !Number.isFinite(anchor.z))
  ) {
    return null;
  }

  return {
    anchor,
    roll,
    scale,
  };
}
