import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TryOnController,
  TryOnPrimaryState,
  TryOnTrackingState,
} from "../try-on-controller";
import { CameraController, FacingMode } from "../camera-controller";
import { MediaPipeFaceTracker } from "../mediapipe-tracker";

function createMockTrack(kind: "video" | "audio" = "video"): MediaStreamTrack {
  return {
    kind,
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
}

function createMockStream(tracks?: MediaStreamTrack[]): MediaStream {
  const trackList = tracks ?? [createMockTrack("video")];
  return {
    getTracks: vi.fn(() => trackList),
    getVideoTracks: vi.fn(() => trackList.filter((t) => t.kind === "video")),
  } as unknown as MediaStream;
}

function createMockTracker(): MediaPipeFaceTracker {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    detectForVideo: vi.fn().mockReturnValue(null),
    close: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
  } as unknown as MediaPipeFaceTracker;
}

describe("TryOnController - Interactive Lifecycle & State Transitions", () => {
  const originalMediaDevices =
    typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (typeof navigator !== "undefined") {
      Object.defineProperty(navigator, "mediaDevices", {
        value: originalMediaDevices,
        configurable: true,
        writable: true,
      });
    }
  });

  it("starts in idle state with no-face and no camera or tracker initialized", () => {
    const controller = new TryOnController();

    expect(controller.getPrimaryState()).toBe("idle");
    expect(controller.getTrackingState()).toBe("no-face");
    expect(controller.getError()).toBeNull();
    expect(controller.getStream()).toBeNull();
    expect(controller.getTracker()).toBeNull();
    expect(controller.getCanFlip()).toBe(false);
    expect(controller.isRunning()).toBe(false);
  });

  it("handles explicit user start action: initializing -> permission-pending -> running", async () => {
    const mockStream = createMockStream();
    const mockTracker = createMockTracker();

    const mockCameraController = {
      start: vi.fn().mockResolvedValue(mockStream),
      stop: vi.fn(),
      toggleFacingMode: vi.fn().mockResolvedValue(mockStream),
      dispose: vi.fn(),
      getStream: vi.fn().mockReturnValue(mockStream),
      getFacingMode: vi.fn().mockReturnValue("user" as FacingMode),
    } as unknown as CameraController;

    const stateTransitions: TryOnPrimaryState[] = [];
    const controller = new TryOnController({
      cameraController: mockCameraController,
      trackerFactory: () => mockTracker,
      onStateChange: (s) => stateTransitions.push(s),
    });

    const startPromise = controller.start();

    // While in-flight, it passes through initializing
    expect(controller.getPrimaryState()).toBe("initializing");

    await startPromise;

    expect(stateTransitions).toEqual([
      "initializing",
      "permission-pending",
      "running",
    ]);
    expect(mockTracker.initialize).toHaveBeenCalledTimes(1);
    expect(mockCameraController.start).toHaveBeenCalledWith("user");
    expect(controller.getPrimaryState()).toBe("running");
    expect(controller.getStream()).toBe(mockStream);
    expect(controller.getTracker()).toBe(mockTracker);
    expect(controller.isRunning()).toBe(true);
  });

  it("safely cleans up and leaves no live tracker if tracker initialization fails", async () => {
    const mockTracker = createMockTracker();
    const trackerError = new Error("WASM compile error");
    vi.mocked(mockTracker.initialize).mockRejectedValue(trackerError);

    const mockCameraController = {
      start: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
    } as unknown as CameraController;

    const controller = new TryOnController({
      cameraController: mockCameraController,
      trackerFactory: () => mockTracker,
    });

    await controller.start();

    expect(controller.getPrimaryState()).toBe("error");
    expect(controller.getTracker()).toBeNull();
    expect(mockTracker.close).toHaveBeenCalledTimes(1);
    expect(mockCameraController.start).not.toHaveBeenCalled();
    expect(controller.getError()).toEqual({
      type: "initialization-failure",
      message: "WASM compile error",
    });
  });

  it("closes and nulls tracker if camera fails after tracker initialization (NotAllowedError)", async () => {
    const mockTracker = createMockTracker();

    const mockCameraController = {
      start: vi.fn().mockImplementation(async () => {
        const err = new Error("NotAllowedError: Permission denied");
        err.name = "NotAllowedError";
        Object.assign(controller, { lastCameraError: err });
        return null;
      }),
      stop: vi.fn(),
      dispose: vi.fn(),
    } as unknown as CameraController;

    const controller = new TryOnController({
      cameraController: mockCameraController,
      trackerFactory: () => mockTracker,
    });

    await controller.start();

    expect(mockTracker.initialize).toHaveBeenCalledTimes(1);
    expect(mockTracker.close).toHaveBeenCalledTimes(1);
    expect(controller.getTracker()).toBeNull();
    expect(controller.getPrimaryState()).toBe("error");
    expect(controller.getError()?.type).toBe("permission-denied");
    expect(controller.getError()?.message).toContain(
      "Camera access was denied",
    );
  });

  it("maps NotFoundError to unsupported-browser and closes tracker", async () => {
    const mockTracker = createMockTracker();
    const mockCameraController = {
      start: vi.fn().mockImplementation(async () => {
        const err = new Error("NotFoundError: Requested device not found");
        err.name = "NotFoundError";
        Object.assign(controller, { lastCameraError: err });
        return null;
      }),
      stop: vi.fn(),
      dispose: vi.fn(),
    } as unknown as CameraController;

    const controller = new TryOnController({
      cameraController: mockCameraController,
      trackerFactory: () => mockTracker,
    });

    await controller.start();

    expect(mockTracker.close).toHaveBeenCalledTimes(1);
    expect(controller.getTracker()).toBeNull();
    expect(controller.getPrimaryState()).toBe("error");
    expect(controller.getError()?.type).toBe("unsupported-browser");
  });

  it("allows retry recovery from error state", async () => {
    const mockStream = createMockStream();
    const mockTracker = createMockTracker();

    let shouldFail = true;
    const mockCameraController = {
      start: vi.fn().mockImplementation(async () => {
        if (shouldFail) {
          const err = new Error("NotAllowedError");
          err.name = "NotAllowedError";
          Object.assign(controller, { lastCameraError: err });
          return null;
        }
        return mockStream;
      }),
      stop: vi.fn(),
      dispose: vi.fn(),
    } as unknown as CameraController;

    const controller = new TryOnController({
      cameraController: mockCameraController,
      trackerFactory: () => mockTracker,
    });

    // First attempt fails
    await controller.start();
    expect(controller.getPrimaryState()).toBe("error");

    // Retry succeeds
    shouldFail = false;
    await controller.retry();

    expect(controller.getPrimaryState()).toBe("running");
    expect(controller.getError()).toBeNull();
    expect(controller.getStream()).toBe(mockStream);
    expect(controller.getTracker()).toBe(mockTracker);
  });

  it("allows reset recovery from error state back to idle", async () => {
    const mockTracker = createMockTracker();
    const mockCameraController = {
      start: vi.fn().mockImplementation(async () => {
        const err = new Error("Some error");
        Object.assign(controller, { lastCameraError: err });
        return null;
      }),
      stop: vi.fn(),
      dispose: vi.fn(),
    } as unknown as CameraController;

    const controller = new TryOnController({
      cameraController: mockCameraController,
      trackerFactory: () => mockTracker,
    });

    await controller.start();
    expect(controller.getPrimaryState()).toBe("error");

    controller.reset();

    expect(controller.getPrimaryState()).toBe("idle");
    expect(controller.getError()).toBeNull();
    expect(controller.getStream()).toBeNull();
    expect(controller.getTracker()).toBeNull();
  });

  it("stops running session, closes tracker and stream, and resets to idle", async () => {
    const mockStream = createMockStream();
    const mockTracker = createMockTracker();

    const mockCameraController = {
      start: vi.fn().mockResolvedValue(mockStream),
      stop: vi.fn(),
      dispose: vi.fn(),
    } as unknown as CameraController;

    const controller = new TryOnController({
      cameraController: mockCameraController,
      trackerFactory: () => mockTracker,
    });

    await controller.start();
    expect(controller.isRunning()).toBe(true);

    controller.stop();

    expect(mockCameraController.stop).toHaveBeenCalled();
    expect(mockTracker.close).toHaveBeenCalled();
    expect(controller.getPrimaryState()).toBe("idle");
    expect(controller.getStream()).toBeNull();
    expect(controller.getTracker()).toBeNull();
    expect(controller.isRunning()).toBe(false);
  });

  describe("Tracking State Transitions (no-face -> face-detected -> tracking-lost -> reset)", () => {
    it("preserves no-face if face was never detected in the session", () => {
      const controller = new TryOnController();

      expect(controller.getTrackingState()).toBe("no-face");

      // Signal tracking lost before any face was detected
      controller.onTrackingStatusChange("lost");
      expect(controller.getTrackingState()).toBe("no-face");
    });

    it("transitions to face-detected when detected, and tracking-lost only after previous detection", () => {
      const trackingHistory: TryOnTrackingState[] = [];
      const controller = new TryOnController({
        onTrackingStateChange: (t) => trackingHistory.push(t),
      });

      // 1. Initially no-face
      expect(controller.getTrackingState()).toBe("no-face");

      // 2. Face detected
      controller.onTrackingStatusChange("detected");
      expect(controller.getTrackingState()).toBe("face-detected");

      // 3. Face lost after detection -> tracking-lost
      controller.onTrackingStatusChange("lost");
      expect(controller.getTrackingState()).toBe("tracking-lost");

      // 4. Face re-detected -> face-detected
      controller.onTrackingStatusChange("detected");
      expect(controller.getTrackingState()).toBe("face-detected");

      // 5. Session stopped -> resets to no-face
      controller.stop();
      expect(controller.getTrackingState()).toBe("no-face");

      expect(trackingHistory).toEqual([
        "face-detected",
        "tracking-lost",
        "face-detected",
        "no-face",
      ]);
    });
  });

  describe("Camera Flip Capability & Toggle", () => {
    it("reports canFlip = false when only single camera is present", async () => {
      const mockStream = createMockStream();
      const mockTracker = createMockTracker();

      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          enumerateDevices: vi.fn().mockResolvedValue([
            { kind: "videoinput", deviceId: "cam1" },
            { kind: "audioinput", deviceId: "mic1" },
          ]),
        },
        configurable: true,
        writable: true,
      });

      const mockCameraController = {
        start: vi.fn().mockResolvedValue(mockStream),
        stop: vi.fn(),
        dispose: vi.fn(),
      } as unknown as CameraController;

      const controller = new TryOnController({
        cameraController: mockCameraController,
        trackerFactory: () => mockTracker,
      });

      await controller.start();
      expect(controller.getCanFlip()).toBe(false);
    });

    it("reports canFlip = true when multiple cameras are present", async () => {
      const mockStream = createMockStream();
      const mockTracker = createMockTracker();

      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          enumerateDevices: vi.fn().mockResolvedValue([
            { kind: "videoinput", deviceId: "cam1" },
            { kind: "videoinput", deviceId: "cam2" },
          ]),
        },
        configurable: true,
        writable: true,
      });

      const mockCameraController = {
        start: vi.fn().mockResolvedValue(mockStream),
        stop: vi.fn(),
        dispose: vi.fn(),
      } as unknown as CameraController;

      const controller = new TryOnController({
        cameraController: mockCameraController,
        trackerFactory: () => mockTracker,
      });

      await controller.start();
      expect(controller.getCanFlip()).toBe(true);
    });

    it("toggles facing mode via camera controller", async () => {
      const firstStream = createMockStream();
      const secondStream = createMockStream();

      const mockCameraController = {
        toggleFacingMode: vi.fn().mockResolvedValue(secondStream),
        stop: vi.fn(),
        dispose: vi.fn(),
      } as unknown as CameraController;

      const controller = new TryOnController({
        cameraController: mockCameraController,
      });

      Object.assign(controller, { stream: firstStream });

      const result = await controller.toggleFacingMode();

      expect(mockCameraController.toggleFacingMode).toHaveBeenCalledTimes(1);
      expect(result).toBe(secondStream);
      expect(controller.getStream()).toBe(secondStream);
    });
  });

  it("safely disposes all resources on dispose()", () => {
    const mockTracker = createMockTracker();
    const mockCameraController = {
      stop: vi.fn(),
      dispose: vi.fn(),
    } as unknown as CameraController;

    const controller = new TryOnController({
      cameraController: mockCameraController,
      trackerFactory: () => mockTracker,
    });

    Object.assign(controller, { tracker: mockTracker });

    controller.dispose();

    expect(mockTracker.close).toHaveBeenCalledTimes(1);
    expect(mockCameraController.stop).toHaveBeenCalledTimes(1);
    expect(mockCameraController.dispose).toHaveBeenCalledTimes(1);
    expect(controller.getPrimaryState()).toBe("idle");
  });

  describe("Async Sequence Guard & Race-Condition Invalidation", () => {
    function createDeferred<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it("stop while tracker.initialize() is pending: late completion cannot start camera or resurrect state", async () => {
      const trackerDeferred = createDeferred<void>();
      const mockTracker = createMockTracker();
      vi.mocked(mockTracker.initialize).mockReturnValue(
        trackerDeferred.promise,
      );

      const mockCameraController = {
        start: vi.fn().mockResolvedValue(createMockStream()),
        stop: vi.fn(),
        dispose: vi.fn(),
      } as unknown as CameraController;

      const controller = new TryOnController({
        cameraController: mockCameraController,
        trackerFactory: () => mockTracker,
      });

      const startPromise = controller.start();
      expect(controller.getPrimaryState()).toBe("initializing");

      // User triggers stop while tracker is still initializing
      controller.stop();
      expect(controller.getPrimaryState()).toBe("idle");
      expect(controller.getTracker()).toBeNull();

      // Resolve tracker initialization late
      trackerDeferred.resolve();
      await startPromise;

      // Invariant: Controller remains idle, camera start was NEVER called, and tracker was closed
      expect(controller.getPrimaryState()).toBe("idle");
      expect(controller.getStream()).toBeNull();
      expect(controller.getTracker()).toBeNull();
      expect(mockCameraController.start).not.toHaveBeenCalled();
      expect(mockTracker.close).toHaveBeenCalledTimes(1);
    });

    it("stop/reset/dispose while camera.start() is pending: late completion cannot return controller to running/error", async () => {
      const cameraDeferred = createDeferred<MediaStream | null>();
      const mockStream = createMockStream();
      const mockTracker = createMockTracker();

      const mockCameraController = {
        start: vi.fn().mockReturnValue(cameraDeferred.promise),
        stop: vi.fn(),
        dispose: vi.fn(),
      } as unknown as CameraController;

      const controller = new TryOnController({
        cameraController: mockCameraController,
        trackerFactory: () => mockTracker,
      });

      const startPromise = controller.start();
      // Wait a microtask tick for tracker.initialize() to resolve and reach permission-pending
      await Promise.resolve();
      expect(controller.getPrimaryState()).toBe("permission-pending");

      // User triggers stop while camera start is in-flight
      controller.stop();
      expect(controller.getPrimaryState()).toBe("idle");

      // Resolve camera with stream late (or with null)
      cameraDeferred.resolve(mockStream);
      await startPromise;

      // Invariant: Controller remains idle, no active stream or tracker, tracker closed
      expect(controller.getPrimaryState()).toBe("idle");
      expect(controller.getError()).toBeNull();
      expect(controller.getStream()).toBeNull();
      expect(controller.getTracker()).toBeNull();
      expect(mockTracker.close).toHaveBeenCalledTimes(1);
    });

    it("rapid/concurrent start attempts: only the newest attempt owns active resources; obsolete tracker is closed", async () => {
      const tracker1Deferred = createDeferred<void>();
      const tracker2Deferred = createDeferred<void>();

      const mockTracker1 = createMockTracker();
      vi.mocked(mockTracker1.initialize).mockReturnValue(
        tracker1Deferred.promise,
      );

      const mockTracker2 = createMockTracker();
      vi.mocked(mockTracker2.initialize).mockReturnValue(
        tracker2Deferred.promise,
      );

      let trackerCount = 0;
      const trackerFactory = () => {
        trackerCount++;
        return trackerCount === 1 ? mockTracker1 : mockTracker2;
      };

      const stream2 = createMockStream();
      const mockCameraController = {
        start: vi.fn().mockResolvedValue(stream2),
        stop: vi.fn(),
        dispose: vi.fn(),
      } as unknown as CameraController;

      const controller = new TryOnController({
        cameraController: mockCameraController,
        trackerFactory,
      });

      // Rapid successive start calls
      const startPromise1 = controller.start();
      const startPromise2 = controller.start();

      // Resolve tracker 1 first, then tracker 2
      tracker1Deferred.resolve();
      await startPromise1;

      tracker2Deferred.resolve();
      await startPromise2;

      // Invariant: Obsolete tracker 1 is closed, only tracker 2 and stream 2 are active
      expect(mockTracker1.close).toHaveBeenCalledTimes(1);
      expect(controller.getPrimaryState()).toBe("running");
      expect(controller.getTracker()).toBe(mockTracker2);
      expect(controller.getStream()).toBe(stream2);
      expect(controller.isRunning()).toBe(true);
    });
  });
});
