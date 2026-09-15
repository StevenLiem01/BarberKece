import { LandmarkMap } from "@barberkece/core/try-on";

/**
 * MediaPipe Face Landmarker (468/478 standard mesh) landmark mapping for M6-01 geometry.
 *
 * Topology verification:
 * - Landmark 159: Superior margin (upper eyelid midpoint) of the left eye contour.
 *   (Sits between outer corner 33 and inner corner 133, opposite inferior margin 145).
 * - Landmark 386: Superior margin (upper eyelid midpoint) of the right eye contour.
 *   (Sits between outer corner 263 and inner corner 362, opposite inferior margin 374).
 *
 * Rationale for M6-01:
 * 1. Symmetry: 159 and 386 are strictly bilateral and symmetrical across the facial sagittal plane.
 * 2. Anchor point: Their derived midpoint `(leftEye + rightEye) / 2` corresponds to the upper nasal
 *    bridge (nasion), establishing a stable reference below the hairline for hairstyle calibration.
 * 3. Scale & Roll: The inter-ocular distance vector between 159 and 386 remains invariant to mouth/jaw
 *    articulation and provides a reliable baseline for 2D roll tilt and depth-based scale estimation
 *    without requiring iris tracking (landmarks 468/473).
 */
export const MEDIA_PIPE_LANDMARK_MAP: LandmarkMap = {
  leftEye: 159,
  rightEye: 386,
};
