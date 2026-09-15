import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CameraController } from "../camera-controller";

function createMockTrack(kind: "video" | "audio" = "video") {
  return {
    kind,
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
}

function createMockStream(tracks?: MediaStreamTrack[]) {
  const trackList = tracks ?? [createMockTrack("video")];
  return {
    getTracks: vi.fn(() => trackList),
    getVideoTracks: vi.fn(() => trackList.filter((t) => t.kind === "video")),
  } as unknown as MediaStream;
}

describe("CameraController", () => {
  const originalMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: originalMediaDevices,
      configurable: true,
      writable: true,
    });
  });

  it("does NOT start camera or call getUserMedia upon instantiation", () => {
    const getUserMedia = vi.fn().mockResolvedValue(createMockStream());
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
      writable: true,
    });

    const controller = new CameraController();

    expect(controller.getStream()).toBeNull();
    expect(controller.getFacingMode()).toBe("user");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("calls getUserMedia with requested facing mode on explicit start()", async () => {
    const mockStream = createMockStream();
    const getUserMedia = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
      writable: true,
    });

    const onStreamChange = vi.fn();
    const onLoadingChange = vi.fn();
    const controller = new CameraController({
      onStreamChange,
      onLoadingChange,
    });

    const streamPromise = controller.start("environment");
    expect(onLoadingChange).toHaveBeenCalledWith(true);

    const stream = await streamPromise;

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "environment" },
      audio: false,
    });
    expect(stream).toBe(mockStream);
    expect(controller.getStream()).toBe(mockStream);
    expect(controller.getFacingMode()).toBe("environment");
    expect(onStreamChange).toHaveBeenCalledWith(mockStream);
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
  });

  it("stops every MediaStreamTrack on stop() and clears stream state", async () => {
    const track1 = createMockTrack("video");
    const track2 = createMockTrack("video");
    const mockStream = createMockStream([track1, track2]);

    const getUserMedia = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
      writable: true,
    });

    const onStreamChange = vi.fn();
    const controller = new CameraController({ onStreamChange });

    await controller.start("user");
    expect(controller.getStream()).toBe(mockStream);

    controller.stop();

    expect(track1.stop).toHaveBeenCalledTimes(1);
    expect(track2.stop).toHaveBeenCalledTimes(1);
    expect(controller.getStream()).toBeNull();
    expect(onStreamChange).toHaveBeenLastCalledWith(null);
  });

  it("stops all tracks when dispose() is called", async () => {
    const track = createMockTrack("video");
    const mockStream = createMockStream([track]);

    const getUserMedia = vi.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
      writable: true,
    });

    const controller = new CameraController();
    await controller.start("user");

    controller.dispose();

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(controller.getStream()).toBeNull();

    // Subsequent start calls after dispose should return null
    const result = await controller.start("user");
    expect(result).toBeNull();
  });

  it("does not leak previous stream on facing-mode switch", async () => {
    const firstTrack = createMockTrack("video");
    const firstStream = createMockStream([firstTrack]);

    const secondTrack = createMockTrack("video");
    const secondStream = createMockStream([secondTrack]);

    let callCount = 0;
    const getUserMedia = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(callCount === 1 ? firstStream : secondStream);
    });

    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
      writable: true,
    });

    const onFacingModeChange = vi.fn();
    const controller = new CameraController({ onFacingModeChange });

    await controller.start("user");
    expect(controller.getFacingMode()).toBe("user");
    expect(firstTrack.stop).not.toHaveBeenCalled();

    // Toggle facing mode to environment
    await controller.toggleFacingMode();

    expect(firstTrack.stop).toHaveBeenCalledTimes(1);
    expect(controller.getStream()).toBe(secondStream);
    expect(controller.getFacingMode()).toBe("environment");
    expect(onFacingModeChange).toHaveBeenCalledWith("environment");
    expect(secondTrack.stop).not.toHaveBeenCalled();
  });

  it("fails safely and notifies onError without leaking resources if getUserMedia rejects", async () => {
    const error = new Error("NotAllowedError: Permission denied");
    const getUserMedia = vi.fn().mockRejectedValue(error);

    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
      writable: true,
    });

    const onError = vi.fn();
    const onStreamChange = vi.fn();
    const onLoadingChange = vi.fn();
    const controller = new CameraController({
      onError,
      onStreamChange,
      onLoadingChange,
    });

    const result = await controller.start("user");

    expect(result).toBeNull();
    expect(controller.getStream()).toBeNull();
    expect(onError).toHaveBeenCalledWith(error);
    expect(onStreamChange).not.toHaveBeenCalledWith(expect.anything());
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
  });

  it("discards and stops late-resolving stream if stopped before getUserMedia resolves", async () => {
    const track = createMockTrack("video");
    const mockStream = createMockStream([track]);

    let resolveStream!: (stream: MediaStream) => void;
    const pendingPromise = new Promise<MediaStream>((res) => {
      resolveStream = res;
    });

    const getUserMedia = vi.fn().mockReturnValue(pendingPromise);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
      writable: true,
    });

    const controller = new CameraController();

    const startPromise = controller.start("user");

    // Immediately stop before promise resolves
    controller.stop();

    // Now resolve the in-flight getUserMedia
    resolveStream(mockStream);
    await startPromise;

    // The stream arrived late, so its tracks must be immediately stopped
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(controller.getStream()).toBeNull();
  });
});
