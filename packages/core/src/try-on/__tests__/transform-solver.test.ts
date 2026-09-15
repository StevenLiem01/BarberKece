import { describe, expect, it } from "vitest";
import { solveTransform } from "../transform-solver.js";
import { AssetCalibration, Pose } from "../types.js";

describe("TransformSolver", () => {
  const canvasWidth = 1000;
  const canvasHeight = 1000;

  it("calculates transform for a neutral pose and centered asset correctly", () => {
    const pose: Pose = {
      anchor: { x: 0.5, y: 0.5 },
      scale: 1.0,
      roll: 0,
    };

    const calibration: AssetCalibration = {
      baselineWidth: 200,
      baselineHeight: 200,
    };

    const transform = solveTransform(
      pose,
      calibration,
      canvasWidth,
      canvasHeight,
    );

    // Anchor is at (500, 500)
    // Asset scaled size is 200x200
    // To center the asset on the anchor, top-left should be (400, 400)
    expect(transform).not.toBeNull();
    expect(transform?.translationX).toBe(400);
    expect(transform?.translationY).toBe(400);
    expect(transform?.scale).toBe(1.0);
    expect(transform?.rotation).toBe(0);
  });

  it("calculates transform for a scaled and rotated pose", () => {
    const pose: Pose = {
      anchor: { x: 0.5, y: 0.5 },
      scale: 2.0,
      roll: Math.PI / 4,
    };

    const calibration: AssetCalibration = {
      baselineWidth: 100,
      baselineHeight: 150,
    };

    const transform = solveTransform(
      pose,
      calibration,
      canvasWidth,
      canvasHeight,
    );

    // Scaled asset size is 200 x 300
    // Anchor is at (500, 500)
    // Top-left is (400, 350)
    expect(transform).not.toBeNull();
    expect(transform?.translationX).toBe(400);
    expect(transform?.translationY).toBe(350);
    expect(transform?.scale).toBe(2.0);
    expect(transform?.rotation).toBe(Math.PI / 4);
  });

  it("applies positive anchor offsets correctly", () => {
    const pose: Pose = {
      anchor: { x: 0.5, y: 0.5 },
      scale: 1.0,
      roll: 0,
    };

    const calibration: AssetCalibration = {
      baselineWidth: 200,
      baselineHeight: 200,
      anchorOffsetX: 0.1, // Shift anchor 10% to the right -> asset moves 10% left
      anchorOffsetY: 0.2, // Shift anchor 20% down -> asset moves 20% up
    };

    const transform = solveTransform(
      pose,
      calibration,
      canvasWidth,
      canvasHeight,
    );

    // Un-offset center translation is (400, 400)
    // Offset X = 0.1 * 200 = 20 -> Translation X = 400 - 20 = 380
    // Offset Y = 0.2 * 200 = 40 -> Translation Y = 400 - 40 = 360
    expect(transform).not.toBeNull();
    expect(transform?.translationX).toBe(380);
    expect(transform?.translationY).toBe(360);
  });

  it("applies negative anchor offsets correctly", () => {
    const pose: Pose = {
      anchor: { x: 0.5, y: 0.5 },
      scale: 2.0,
      roll: 0,
    };

    const calibration: AssetCalibration = {
      baselineWidth: 200,
      baselineHeight: 200,
      anchorOffsetX: -0.1,
      anchorOffsetY: -0.2,
    };

    const transform = solveTransform(
      pose,
      calibration,
      canvasWidth,
      canvasHeight,
    );

    // Scaled asset size is 400x400
    // Un-offset translation is (500 - 200, 500 - 200) = (300, 300)
    // Offset X = -0.1 * 400 = -40 -> Translation X = 300 - (-40) = 340
    // Offset Y = -0.2 * 400 = -80 -> Translation Y = 300 - (-80) = 380
    expect(transform).not.toBeNull();
    expect(transform?.translationX).toBe(340);
    expect(transform?.translationY).toBe(380);
  });

  it("returns null for non-positive or non-finite canvas dimensions", () => {
    const pose: Pose = {
      anchor: { x: 0.5, y: 0.5 },
      scale: 1.0,
      roll: 0,
    };
    const calibration: AssetCalibration = {
      baselineWidth: 200,
      baselineHeight: 200,
    };

    expect(solveTransform(pose, calibration, 0, 1000)).toBeNull();
    expect(solveTransform(pose, calibration, -500, 1000)).toBeNull();
    expect(solveTransform(pose, calibration, Number.NaN, 1000)).toBeNull();
    expect(solveTransform(pose, calibration, 1000, 0)).toBeNull();
    expect(solveTransform(pose, calibration, 1000, -100)).toBeNull();
    expect(
      solveTransform(pose, calibration, 1000, Number.POSITIVE_INFINITY),
    ).toBeNull();
  });

  it("returns null for invalid or non-finite pose attributes", () => {
    const calibration: AssetCalibration = {
      baselineWidth: 200,
      baselineHeight: 200,
    };

    // Non-positive or non-finite scale
    expect(
      solveTransform(
        { anchor: { x: 0.5, y: 0.5 }, scale: 0, roll: 0 },
        calibration,
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
    expect(
      solveTransform(
        { anchor: { x: 0.5, y: 0.5 }, scale: -1, roll: 0 },
        calibration,
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
    expect(
      solveTransform(
        { anchor: { x: 0.5, y: 0.5 }, scale: Number.NaN, roll: 0 },
        calibration,
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();

    // Non-finite anchor coordinates
    expect(
      solveTransform(
        { anchor: { x: Number.NaN, y: 0.5 }, scale: 1, roll: 0 },
        calibration,
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
    expect(
      solveTransform(
        { anchor: { x: 0.5, y: Number.POSITIVE_INFINITY }, scale: 1, roll: 0 },
        calibration,
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
    expect(
      solveTransform(
        { anchor: { x: 0.5, y: 0.5, z: Number.NaN }, scale: 1, roll: 0 },
        calibration,
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();

    // Non-finite roll
    expect(
      solveTransform(
        { anchor: { x: 0.5, y: 0.5 }, scale: 1, roll: Number.NaN },
        calibration,
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
  });

  it("returns null for invalid or non-finite asset calibration", () => {
    const pose: Pose = {
      anchor: { x: 0.5, y: 0.5 },
      scale: 1.0,
      roll: 0,
    };

    expect(
      solveTransform(
        pose,
        { baselineWidth: 0, baselineHeight: 200 },
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
    expect(
      solveTransform(
        pose,
        { baselineWidth: -100, baselineHeight: 200 },
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
    expect(
      solveTransform(
        pose,
        { baselineWidth: Number.NaN, baselineHeight: 200 },
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
    expect(
      solveTransform(
        pose,
        { baselineWidth: 200, baselineHeight: 0 },
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
    expect(
      solveTransform(
        pose,
        { baselineWidth: 200, baselineHeight: 200, anchorOffsetX: Number.NaN },
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
    expect(
      solveTransform(
        pose,
        {
          baselineWidth: 200,
          baselineHeight: 200,
          anchorOffsetY: Number.POSITIVE_INFINITY,
        },
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
  });

  it("is mathematically repeatable for identical inputs", () => {
    const pose: Pose = {
      anchor: { x: 0.5, y: 0.5 },
      scale: 2.0,
      roll: 0.5,
    };

    const calibration: AssetCalibration = {
      baselineWidth: 200,
      baselineHeight: 200,
      anchorOffsetX: -0.1,
    };

    const transform1 = solveTransform(
      pose,
      calibration,
      canvasWidth,
      canvasHeight,
    );
    const transform2 = solveTransform(
      pose,
      calibration,
      canvasWidth,
      canvasHeight,
    );

    expect(transform1).toEqual(transform2);
  });
});
