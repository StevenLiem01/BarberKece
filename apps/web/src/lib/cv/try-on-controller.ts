import { CameraController, FacingMode } from "./camera-controller";
import { MediaPipeFaceTracker } from "./mediapipe-tracker";

export type TryOnPrimaryState =
  "idle" | "permission-pending" | "initializing" | "running" | "error";

export type TryOnTrackingState = "no-face" | "face-detected" | "tracking-lost";

export type TryOnErrorType =
  "permission-denied" | "unsupported-browser" | "initialization-failure";

export interface TryOnStateError {
  type: TryOnErrorType;
  message: string;
}

export interface TryOnControllerOptions {
  cameraController?: CameraController;
  trackerFactory?: () => MediaPipeFaceTracker;
  onStateChange?: (state: TryOnPrimaryState) => void;
  onTrackingStateChange?: (state: TryOnTrackingState) => void;
  onErrorChange?: (error: TryOnStateError | null) => void;
  onStreamChange?: (stream: MediaStream | null) => void;
  onTrackerChange?: (tracker: MediaPipeFaceTracker | null) => void;
  onCanFlipChange?: (canFlip: boolean) => void;
  onFacingModeChange?: (mode: FacingMode) => void;
}

export class TryOnController {
  private primaryState: TryOnPrimaryState = "idle";
  private trackingState: TryOnTrackingState = "no-face";
  private error: TryOnStateError | null = null;
  private stream: MediaStream | null = null;
  private tracker: MediaPipeFaceTracker | null = null;
  private canFlip = false;
  private facingMode: FacingMode = "user";
  private isDisposed = false;
  private lastCameraError: Error | null = null;
  private startRequestId = 0;

  readonly cameraController: CameraController;
  private readonly options: TryOnControllerOptions;

  constructor(options: TryOnControllerOptions = {}) {
    this.options = options;

    this.cameraController =
      options.cameraController ??
      new CameraController({
        onStreamChange: (s) => {
          this.stream = s;
          this.options.onStreamChange?.(s);
        },
        onError: (err) => {
          this.lastCameraError = err;
        },
        onFacingModeChange: (mode) => {
          this.facingMode = mode;
          this.options.onFacingModeChange?.(mode);
        },
      });
  }

  getPrimaryState(): TryOnPrimaryState {
    return this.primaryState;
  }

  getTrackingState(): TryOnTrackingState {
    return this.trackingState;
  }

  getError(): TryOnStateError | null {
    return this.error;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getTracker(): MediaPipeFaceTracker | null {
    return this.tracker;
  }

  getCanFlip(): boolean {
    return this.canFlip;
  }

  getFacingMode(): FacingMode {
    return this.facingMode;
  }

  isRunning(): boolean {
    return this.primaryState === "running" && !!this.stream && !!this.tracker;
  }

  private setPrimaryState(state: TryOnPrimaryState): void {
    if (this.isDisposed) return;
    this.primaryState = state;
    this.options.onStateChange?.(state);
  }

  private setTrackingState(state: TryOnTrackingState): void {
    if (this.isDisposed) return;
    this.trackingState = state;
    this.options.onTrackingStateChange?.(state);
  }

  private setError(err: TryOnStateError | null): void {
    if (this.isDisposed) return;
    this.error = err;
    this.options.onErrorChange?.(err);
  }

  private setCanFlip(canFlip: boolean): void {
    if (this.isDisposed) return;
    this.canFlip = canFlip;
    this.options.onCanFlipChange?.(canFlip);
  }

  async start(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    const currentRequestId = ++this.startRequestId;

    // Clean up any existing tracker before fresh start
    if (this.tracker) {
      try {
        this.tracker.close();
      } catch {
        // Safe discard
      }
      this.tracker = null;
      this.options.onTrackerChange?.(null);
    }
    this.cameraController.stop();

    this.setError(null);
    this.setTrackingState("no-face");
    this.setPrimaryState("initializing");

    // 1. Initialize tracker
    let newTracker: MediaPipeFaceTracker | null = null;
    try {
      newTracker = this.options.trackerFactory
        ? this.options.trackerFactory()
        : new MediaPipeFaceTracker();
      await newTracker.initialize();
    } catch (trackerErr) {
      if (this.isDisposed || currentRequestId !== this.startRequestId) {
        if (newTracker) {
          try {
            newTracker.close();
          } catch {
            // Safe discard
          }
        }
        return;
      }
      if (newTracker) {
        try {
          newTracker.close();
        } catch {
          // Safe discard
        }
      }
      this.tracker = null;
      this.options.onTrackerChange?.(null);
      this.setPrimaryState("error");
      this.setError({
        type: "initialization-failure",
        message:
          trackerErr instanceof Error
            ? trackerErr.message
            : "Failed to load face tracker",
      });
      return;
    }

    // Sequence check after tracker initialization
    if (this.isDisposed || currentRequestId !== this.startRequestId) {
      if (newTracker) {
        try {
          newTracker.close();
        } catch {
          // Safe discard
        }
      }
      return;
    }

    this.tracker = newTracker;
    this.options.onTrackerChange?.(newTracker);

    // 2. Request camera with explicit permission flow
    this.setPrimaryState("permission-pending");
    const stream = await this.cameraController.start(this.facingMode);

    // Sequence check after camera acquisition
    if (this.isDisposed || currentRequestId !== this.startRequestId) {
      if (this.tracker) {
        try {
          this.tracker.close();
        } catch {
          // Safe discard
        }
        this.tracker = null;
        this.options.onTrackerChange?.(null);
      }
      return;
    }

    if (!stream) {
      // Camera failed after tracker initialization - must close tracker to prevent leaks
      if (this.tracker) {
        try {
          this.tracker.close();
        } catch {
          // Safe discard
        }
        this.tracker = null;
        this.options.onTrackerChange?.(null);
      }
      this.setPrimaryState("error");
      this.mapAndSetCameraError(this.lastCameraError);
      return;
    }

    this.stream = stream;
    this.setPrimaryState("running");
    await this.checkCanFlip();
  }

  stop(): void {
    this.startRequestId++;
    this.cameraController.stop();
    if (this.tracker) {
      try {
        this.tracker.close();
      } catch {
        // Safe discard
      }
      this.tracker = null;
      this.options.onTrackerChange?.(null);
    }
    this.stream = null;
    this.setPrimaryState("idle");
    this.setTrackingState("no-face");
    this.setError(null);
    this.setCanFlip(false);
  }

  async retry(): Promise<void> {
    return this.start();
  }

  reset(): void {
    this.stop();
  }

  async toggleFacingMode(): Promise<MediaStream | null> {
    const stream = await this.cameraController.toggleFacingMode();
    if (stream) {
      this.stream = stream;
      await this.checkCanFlip();
    }
    return stream;
  }

  onTrackingStatusChange(status: "detected" | "lost"): void {
    if (status === "detected") {
      this.setTrackingState("face-detected");
    } else if (status === "lost") {
      // Transition to tracking-lost only after a face was previously detected in this session
      if (
        this.trackingState === "face-detected" ||
        this.trackingState === "tracking-lost"
      ) {
        this.setTrackingState("tracking-lost");
      } else {
        this.setTrackingState("no-face");
      }
    }
  }

  private async checkCanFlip(): Promise<void> {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== "function"
    ) {
      this.setCanFlip(false);
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (this.isDisposed) return;
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      this.setCanFlip(videoInputs.length > 1);
    } catch {
      if (!this.isDisposed) {
        this.setCanFlip(false);
      }
    }
  }

  private mapAndSetCameraError(err: Error | null): void {
    let errorType: TryOnErrorType = "initialization-failure";
    let errorMessage = err?.message || "Failed to access camera";
    const errorName = err?.name || "";

    if (
      errorName === "NotAllowedError" ||
      errorMessage.includes("Permission denied") ||
      errorMessage.includes("NotAllowedError")
    ) {
      errorType = "permission-denied";
      errorMessage =
        "Camera access was denied. Please allow camera access in your browser settings.";
    } else if (
      errorName === "NotFoundError" ||
      errorName === "NotSupportedError" ||
      errorMessage.includes("NotFoundError") ||
      errorMessage.includes("NotSupportedError")
    ) {
      errorType = "unsupported-browser";
      errorMessage = "No camera found or your browser is not supported.";
    }

    this.setError({ type: errorType, message: errorMessage });
  }

  dispose(): void {
    this.isDisposed = true;
    this.startRequestId++;
    this.stop();
    this.cameraController.dispose();
  }
}
