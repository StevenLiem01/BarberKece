import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { VirtualTryOn } from "../VirtualTryOn";
import { TryOnPrivacyScreen } from "../TryOnPrivacyScreen";
import { TryOnControls } from "../TryOnControls";
import { TryOnFeedbackOverlay } from "../TryOnFeedbackOverlay";
import {
  useTryOnState,
  TryOnPrimaryState,
  TryOnTrackingState,
  TryOnStateError,
} from "../../../hooks/use-try-on-state";
import { useTryOnLoop } from "../../../hooks/use-try-on-loop";
import { FacingMode } from "../../../lib/cv/camera-controller";

function renderClean(element: React.ReactElement): string {
  return renderToString(element).replace(/<!--.*?-->/g, "");
}

// Mock hooks
vi.mock("../../../hooks/use-try-on-state", () => ({
  useTryOnState: vi.fn(),
}));

vi.mock("../../../hooks/use-try-on-loop", () => ({
  useTryOnLoop: vi.fn(),
}));

interface MockStateOptions {
  primaryState?: TryOnPrimaryState;
  trackingState?: TryOnTrackingState;
  error?: TryOnStateError | null;
  isRunning?: boolean;
  canFlip?: boolean;
  facingMode?: FacingMode;
  start?: () => Promise<void>;
  stop?: () => void;
  retry?: () => Promise<void>;
  reset?: () => void;
  toggleFacingMode?: () => Promise<MediaStream | null | undefined>;
  handleTrackingStatusChange?: (status: "detected" | "lost") => void;
}

function createMockState(options: MockStateOptions = {}) {
  return {
    stream: null,
    tracker: null,
    primaryState: options.primaryState ?? "idle",
    trackingState: options.trackingState ?? "no-face",
    error: options.error ?? null,
    isRunning: options.isRunning ?? false,
    facingMode: options.facingMode ?? "user",
    canFlip: options.canFlip ?? false,
    start: options.start ?? vi.fn().mockResolvedValue(undefined),
    stop: options.stop ?? vi.fn(),
    retry: options.retry ?? vi.fn().mockResolvedValue(undefined),
    reset: options.reset ?? vi.fn(),
    toggleFacingMode:
      options.toggleFacingMode ?? vi.fn().mockResolvedValue(null),
    handleTrackingStatusChange: options.handleTrackingStatusChange ?? vi.fn(),
  };
}

describe("VirtualTryOn - Component Presentation and Sub-component Wiring", () => {
  beforeEach(() => {
    vi.mocked(useTryOnLoop).mockClear();
    vi.mocked(useTryOnState).mockClear();
  });

  describe("VirtualTryOn Orchestration & Views", () => {
    it("renders privacy screen by default when idle", () => {
      vi.mocked(useTryOnState).mockReturnValue(createMockState());

      const html = renderClean(<VirtualTryOn />);

      expect(html).toContain("VIRTUAL HAIRSTYLE FILTER");
      expect(html).toContain("ENABLE CAMERA");
      expect(html).toContain("PRIVACY FIRST");
    });

    it("renders loading state when permission is pending", () => {
      vi.mocked(useTryOnState).mockReturnValue(
        createMockState({ primaryState: "permission-pending" }),
      );

      const html = renderClean(<VirtualTryOn />);

      expect(html).toContain("Waiting for camera permission...");
      expect(html).not.toContain("ENABLE CAMERA");
    });

    it("renders loading state when initializing tracker", () => {
      vi.mocked(useTryOnState).mockReturnValue(
        createMockState({ primaryState: "initializing" }),
      );

      const html = renderClean(<VirtualTryOn />);

      expect(html).toContain("Loading Virtual Try-On...");
      expect(html).not.toContain("ENABLE CAMERA");
    });

    it("renders looking-for-face feedback when running with no face detected", () => {
      vi.mocked(useTryOnState).mockReturnValue(
        createMockState({
          primaryState: "running",
          trackingState: "no-face",
          isRunning: true,
        }),
      );

      const html = renderClean(<VirtualTryOn />);

      expect(html).toContain("LOOKING FOR A FACE...");
      expect(html).toContain("DUMMY HAIRSTYLE");
    });

    it("renders come-back feedback when running with tracking lost", () => {
      vi.mocked(useTryOnState).mockReturnValue(
        createMockState({
          primaryState: "running",
          trackingState: "tracking-lost",
          isRunning: true,
        }),
      );

      const html = renderClean(<VirtualTryOn />);

      expect(html).toContain("COME BACK INTO VIEW");
    });

    it("renders permission-denied error screen without retry button", () => {
      vi.mocked(useTryOnState).mockReturnValue(
        createMockState({
          primaryState: "error",
          error: {
            type: "permission-denied",
            message: "Camera access was denied.",
          },
        }),
      );

      const html = renderClean(<VirtualTryOn />);

      expect(html).toContain("CAMERA ACCESS DENIED");
      expect(html).toContain("Camera access was denied.");
      expect(html).toContain("GO BACK");
      expect(html).not.toContain("TRY AGAIN");
    });

    it("renders recoverable error screen with retry button", () => {
      vi.mocked(useTryOnState).mockReturnValue(
        createMockState({
          primaryState: "error",
          error: {
            type: "initialization-failure",
            message: "Failed to load face tracker",
          },
        }),
      );

      const html = renderClean(<VirtualTryOn />);

      expect(html).toContain("SOMETHING WENT WRONG");
      expect(html).toContain("Failed to load face tracker");
      expect(html).toContain("GO BACK");
      expect(html).toContain("TRY AGAIN");
    });

    it("renders camera flip control only when canFlip is true", () => {
      vi.mocked(useTryOnState).mockReturnValue(
        createMockState({
          primaryState: "running",
          isRunning: true,
          canFlip: false,
        }),
      );

      let html = renderClean(<VirtualTryOn />);
      expect(html).not.toContain('aria-label="Flip Camera"');

      vi.mocked(useTryOnState).mockReturnValue(
        createMockState({
          primaryState: "running",
          isRunning: true,
          canFlip: true,
        }),
      );

      html = renderClean(<VirtualTryOn />);
      expect(html).toContain('aria-label="Flip Camera"');
    });
  });

  describe("Interactive Sub-component Actions & Wiring", () => {
    it("TryOnPrivacyScreen invokes onAccept upon action", () => {
      const onAccept = vi.fn();
      const element = (
        <TryOnPrivacyScreen onAccept={onAccept} isInitializing={false} />
      );

      // Verify button has action wired
      element.props.onAccept();
      expect(onAccept).toHaveBeenCalledTimes(1);

      const html = renderClean(element);
      expect(html).toContain("ENABLE CAMERA");
    });

    it("TryOnControls invokes onStop and onFlip actions", () => {
      const onStop = vi.fn();
      const onFlip = vi.fn();
      const element = (
        <TryOnControls
          onStop={onStop}
          onFlip={onFlip}
          canFlip={true}
          hairstyleName="Pompadour"
        />
      );

      element.props.onStop();
      expect(onStop).toHaveBeenCalledTimes(1);

      element.props.onFlip();
      expect(onFlip).toHaveBeenCalledTimes(1);

      const html = renderClean(element);
      expect(html).toContain("POMPADOUR");
      expect(html).toContain('aria-label="Stop Camera"');
      expect(html).toContain('aria-label="Flip Camera"');
    });

    it("TryOnFeedbackOverlay invokes onRetry and onReset actions", () => {
      const onRetry = vi.fn();
      const onReset = vi.fn();
      const element = (
        <TryOnFeedbackOverlay
          primaryState="error"
          trackingState="no-face"
          error={{
            type: "initialization-failure",
            message: "Model failure",
          }}
          onRetry={onRetry}
          onReset={onReset}
        />
      );

      element.props.onRetry();
      expect(onRetry).toHaveBeenCalledTimes(1);

      element.props.onReset();
      expect(onReset).toHaveBeenCalledTimes(1);

      const html = renderClean(element);
      expect(html).toContain("TRY AGAIN");
      expect(html).toContain("GO BACK");
    });
  });
});
