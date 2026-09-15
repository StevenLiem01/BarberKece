export type FacingMode = "user" | "environment";

export interface CameraControllerOptions {
  onStreamChange?: (stream: MediaStream | null) => void;
  onError?: (error: Error | null) => void;
  onLoadingChange?: (loading: boolean) => void;
  onFacingModeChange?: (mode: FacingMode) => void;
}

export class CameraController {
  private stream: MediaStream | null = null;
  private facingMode: FacingMode = "user";
  private requestId = 0;
  private isDisposed = false;

  constructor(private options: CameraControllerOptions = {}) {}

  getStream(): MediaStream | null {
    return this.stream;
  }

  getFacingMode(): FacingMode {
    return this.facingMode;
  }

  async start(mode: FacingMode = "user"): Promise<MediaStream | null> {
    if (this.isDisposed) {
      return null;
    }

    // Stop existing stream first to avoid leaking tracks
    this.stop();

    const currentRequestId = ++this.requestId;
    this.options.onLoadingChange?.(true);
    this.options.onError?.(null);

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: false,
      });

      // Guard against disposal or newer requests overtaking while awaiting
      if (this.isDisposed || currentRequestId !== this.requestId) {
        newStream.getTracks().forEach((track) => track.stop());
        return null;
      }

      this.stream = newStream;
      this.facingMode = mode;
      this.options.onStreamChange?.(newStream);
      this.options.onFacingModeChange?.(mode);
      return newStream;
    } catch (err) {
      if (!this.isDisposed && currentRequestId === this.requestId) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.options.onError?.(error);
      }
      return null;
    } finally {
      if (!this.isDisposed && currentRequestId === this.requestId) {
        this.options.onLoadingChange?.(false);
      }
    }
  }

  stop(): void {
    this.requestId++;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.options.onStreamChange?.(null);
    this.options.onLoadingChange?.(false);
  }

  async toggleFacingMode(): Promise<MediaStream | null> {
    const nextMode = this.facingMode === "user" ? "environment" : "user";
    return this.start(nextMode);
  }

  dispose(): void {
    this.isDisposed = true;
    this.stop();
  }
}
