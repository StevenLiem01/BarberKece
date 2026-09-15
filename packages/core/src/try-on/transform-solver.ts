import { AffineTransform, AssetCalibration, Pose } from "./types.js";

/**
 * Computes an AffineTransform to place an asset correctly on a canvas
 * based on the provided Pose and AssetCalibration.
 *
 * @param pose The facial pose containing anchor, scale, and roll.
 * @param calibration The baseline dimensions and offset configuration of the asset.
 * @param canvasWidth The width of the target drawing area (used to resolve normalized coordinates).
 * @param canvasHeight The height of the target drawing area.
 * @returns The AffineTransform containing translation, scale, and rotation, or null if geometry is invalid.
 */
export function solveTransform(
  pose: Pose,
  calibration: AssetCalibration,
  canvasWidth: number,
  canvasHeight: number,
): AffineTransform | null {
  if (
    !pose ||
    !calibration ||
    !Number.isFinite(canvasWidth) ||
    canvasWidth <= 0 ||
    !Number.isFinite(canvasHeight) ||
    canvasHeight <= 0
  ) {
    return null;
  }

  if (
    !pose.anchor ||
    !Number.isFinite(pose.anchor.x) ||
    !Number.isFinite(pose.anchor.y) ||
    (pose.anchor.z !== undefined && !Number.isFinite(pose.anchor.z)) ||
    !Number.isFinite(pose.scale) ||
    pose.scale <= 0 ||
    !Number.isFinite(pose.roll)
  ) {
    return null;
  }

  if (
    !Number.isFinite(calibration.baselineWidth) ||
    calibration.baselineWidth <= 0 ||
    !Number.isFinite(calibration.baselineHeight) ||
    calibration.baselineHeight <= 0 ||
    (calibration.anchorOffsetX !== undefined &&
      !Number.isFinite(calibration.anchorOffsetX)) ||
    (calibration.anchorOffsetY !== undefined &&
      !Number.isFinite(calibration.anchorOffsetY))
  ) {
    return null;
  }

  // Convert normalized anchor to absolute pixel coordinates on the canvas
  const anchorPixelX = pose.anchor.x * canvasWidth;
  const anchorPixelY = pose.anchor.y * canvasHeight;

  // The final scale is the pose scale (how big the face is relative to the neutral baseline)
  const finalScale = pose.scale;

  // The asset's current scaled dimensions
  const scaledWidth = calibration.baselineWidth * finalScale;
  const scaledHeight = calibration.baselineHeight * finalScale;

  // Calculate the default center translation (placing the center of the asset at the anchor point)
  let translationX = anchorPixelX - scaledWidth / 2;
  let translationY = anchorPixelY - scaledHeight / 2;

  // Apply asset-specific offset if provided
  // These offsets are relative to the asset's size.
  // For example, if anchorOffsetX is 0.1, the anchor point is 10% to the right of the center.
  // So we must shift the asset 10% to the left.
  if (calibration.anchorOffsetX !== undefined) {
    translationX -= calibration.anchorOffsetX * scaledWidth;
  }

  if (calibration.anchorOffsetY !== undefined) {
    translationY -= calibration.anchorOffsetY * scaledHeight;
  }

  if (
    !Number.isFinite(translationX) ||
    !Number.isFinite(translationY) ||
    !Number.isFinite(finalScale) ||
    !Number.isFinite(pose.roll)
  ) {
    return null;
  }

  return {
    translationX,
    translationY,
    scale: finalScale,
    rotation: pose.roll, // Roll is already in radians
  };
}
