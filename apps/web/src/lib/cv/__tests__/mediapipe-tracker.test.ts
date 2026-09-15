import { describe, it, expect, vi, beforeEach } from "vitest";
import { MediaPipeFaceTracker } from "../mediapipe-tracker";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: {
    forVisionTasks: vi.fn(),
  },
  FaceLandmarker: {
    createFromOptions: vi.fn(),
  },
}));

function createMockVideo(readyState: number = 4) {
  return {
    readyState,
  } as unknown as HTMLVideoElement;
}

describe("MediaPipeFaceTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null on detectForVideo when not initialized", () => {
    const tracker = new MediaPipeFaceTracker();
    const video = createMockVideo(4);

    const result = tracker.detectForVideo(video, 1000);
    expect(result).toBeNull();
  });

  it("initializes FaceLandmarker using local models and WASM paths", async () => {
    const mockVision = { wasmLoaderPath: "/models/wasm" };
    const mockLandmarker = {
      detectForVideo: vi.fn(),
      close: vi.fn(),
    };

    vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue(
      mockVision as never,
    );
    vi.mocked(FaceLandmarker.createFromOptions).mockResolvedValue(
      mockLandmarker as never,
    );

    const tracker = new MediaPipeFaceTracker();
    await tracker.initialize();

    expect(FilesetResolver.forVisionTasks).toHaveBeenCalledWith("/models/wasm");
    expect(FaceLandmarker.createFromOptions).toHaveBeenCalledWith(mockVision, {
      baseOptions: {
        modelAssetPath: "/models/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: 1,
    });
  });

  it("propagates error if initialization fails", async () => {
    const initError = new Error("WASM compile failed");
    vi.mocked(FilesetResolver.forVisionTasks).mockRejectedValue(initError);

    const tracker = new MediaPipeFaceTracker();
    await expect(tracker.initialize()).rejects.toThrow("WASM compile failed");
  });

  it("returns null if video element is not ready (readyState < 2)", async () => {
    const mockLandmarker = {
      detectForVideo: vi.fn(),
      close: vi.fn(),
    };

    vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as never);
    vi.mocked(FaceLandmarker.createFromOptions).mockResolvedValue(
      mockLandmarker as never,
    );

    const tracker = new MediaPipeFaceTracker();
    await tracker.initialize();

    const notReadyVideo = createMockVideo(1); // HAVE_METADATA only
    const result = tracker.detectForVideo(notReadyVideo, 1000);

    expect(result).toBeNull();
    expect(mockLandmarker.detectForVideo).not.toHaveBeenCalled();
  });

  it("returns null if FaceLandmarker returns no faces", async () => {
    const mockLandmarker = {
      detectForVideo: vi.fn().mockReturnValue({ faceLandmarks: [] }),
      close: vi.fn(),
    };

    vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as never);
    vi.mocked(FaceLandmarker.createFromOptions).mockResolvedValue(
      mockLandmarker as never,
    );

    const tracker = new MediaPipeFaceTracker();
    await tracker.initialize();

    const video = createMockVideo(4);
    const result = tracker.detectForVideo(video, 1234);

    expect(result).toBeNull();
    expect(mockLandmarker.detectForVideo).toHaveBeenCalledWith(video, 1234);
  });

  it("maps detected face landmarks into neutral FaceDetectionResult", async () => {
    const mockLandmarks = [
      { x: 0.1, y: 0.2, z: 0.05 },
      { x: 0.3, y: 0.4, z: -0.01 },
    ];

    const mockLandmarker = {
      detectForVideo: vi.fn().mockReturnValue({
        faceLandmarks: [mockLandmarks],
      }),
      close: vi.fn(),
    };

    vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as never);
    vi.mocked(FaceLandmarker.createFromOptions).mockResolvedValue(
      mockLandmarker as never,
    );

    const tracker = new MediaPipeFaceTracker();
    await tracker.initialize();

    const video = createMockVideo(4);
    const result = tracker.detectForVideo(video, 2000);

    expect(result).toEqual({
      landmarks: mockLandmarks,
    });
  });

  it("closes FaceLandmarker on close() and prevents further detections", async () => {
    const mockLandmarker = {
      detectForVideo: vi.fn(),
      close: vi.fn(),
    };

    vi.mocked(FilesetResolver.forVisionTasks).mockResolvedValue({} as never);
    vi.mocked(FaceLandmarker.createFromOptions).mockResolvedValue(
      mockLandmarker as never,
    );

    const tracker = new MediaPipeFaceTracker();
    await tracker.initialize();

    tracker.close();

    expect(mockLandmarker.close).toHaveBeenCalledTimes(1);

    const video = createMockVideo(4);
    const result = tracker.detectForVideo(video, 3000);
    expect(result).toBeNull();
  });
});
