export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface FaceDetectionResult {
  landmarks: NormalizedLandmark[];
  // Additional provider-neutral bounds can be added here if needed by the renderer later.
}

export interface Pose {
  /** The central normalized point (e.g., between the eyes or nose bridge) used for anchoring */
  anchor: NormalizedLandmark;
  /** Estimated size of the face relative to a neutral baseline */
  scale: number;
  /** Angle of face tilt in the 2D plane (in radians) */
  roll: number;
}

/**
 * Map of semantic facial features to their landmark indices in a provider's mesh.
 * This keeps MediaPipe-specific indices out of the core calculation.
 */
export interface LandmarkMap {
  leftEye: number;
  rightEye: number;
  // Further features (like chin, noseTip) could be added here later if needed for advanced orientation/scale calibration.
}

export interface FaceTracker {
  initialize(): Promise<void>;
  close(): void;
  // Note: detect(image: unknown) is explicitly omitted from this pure boundary.
  // The tracker adapter implementation will type its own input mechanism.
}

export interface AffineTransform {
  translationX: number;
  translationY: number;
  scale: number;
  rotation: number;
}

/** Calibration info for a specific virtual hairstyle asset */
export interface AssetCalibration {
  /** The baseline width of the asset in pixels */
  baselineWidth: number;
  /** The baseline height of the asset in pixels */
  baselineHeight: number;
  /** Optional offset from the asset's center to align with the face anchor (in normalized coordinates relative to asset size) */
  anchorOffsetX?: number;
  /** Optional offset from the asset's center to align with the face anchor (in normalized coordinates relative to asset size) */
  anchorOffsetY?: number;
}
