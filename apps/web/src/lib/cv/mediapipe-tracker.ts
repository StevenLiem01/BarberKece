import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import {
  FaceTracker,
  FaceDetectionResult,
  NormalizedLandmark,
} from "@barberkece/core/try-on";

export class MediaPipeFaceTracker implements FaceTracker {
  private landmarker: FaceLandmarker | null = null;

  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks("/models/wasm");
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/models/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: 1,
    });
  }

  detectForVideo(
    video: HTMLVideoElement,
    timestamp: number,
  ): FaceDetectionResult | null {
    if (!this.landmarker || video.readyState < 2) {
      return null;
    }

    const result = this.landmarker.detectForVideo(video, timestamp);

    if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
      return null;
    }

    // Extract the first face landmarks
    const landmarks = result.faceLandmarks[0] as NormalizedLandmark[];

    return {
      landmarks,
    };
  }

  close(): void {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }
}
