import { describe, expect, it } from "vitest";
import { WorkerRuntime } from "../worker.js";

describe("WorkerRuntime Lifecycle", () => {
  it("initializes in idle state", () => {
    const worker = new WorkerRuntime();
    expect(worker.getState()).toBe("idle");
    expect(worker.isRunning()).toBe(false);
  });

  it("starts successfully and transitions to running state", async () => {
    const logs: string[] = [];
    const worker = new WorkerRuntime({
      tickIntervalMs: 1000,
      logger: (msg) => logs.push(msg),
    });

    await worker.start();
    expect(worker.getState()).toBe("running");
    expect(worker.isRunning()).toBe(true);
    expect(logs).toContain("[Worker] Worker successfully started.");

    await worker.stop();
    expect(worker.getState()).toBe("stopped");
    expect(worker.isRunning()).toBe(false);
  });

  it("gracefully stops and executes registered cleanup handlers", async () => {
    const logs: string[] = [];
    let cleanupCalled = false;

    const worker = new WorkerRuntime({
      tickIntervalMs: 1000,
      logger: (msg) => logs.push(msg),
    });

    worker.registerCleanupHandler(async () => {
      cleanupCalled = true;
    });

    await worker.start();
    expect(worker.isRunning()).toBe(true);

    await worker.stop("SIGTERM");

    expect(cleanupCalled).toBe(true);
    expect(worker.getState()).toBe("stopped");
    expect(worker.isRunning()).toBe(false);
    expect(logs).toContain(
      "[Worker] Initiating graceful shutdown (reason: SIGTERM)...",
    );
    expect(logs).toContain("[Worker] Worker shutdown complete.");
  });

  it("stop() is idempotent and does not execute double cleanup", async () => {
    let cleanupCount = 0;
    const worker = new WorkerRuntime();

    worker.registerCleanupHandler(() => {
      cleanupCount++;
    });

    await worker.start();
    await worker.stop("first");
    await worker.stop("second");

    expect(cleanupCount).toBe(1);
    expect(worker.getState()).toBe("stopped");
  });

  it("handles errors in cleanup handlers without throwing unhandled rejection", async () => {
    const logs: string[] = [];
    const worker = new WorkerRuntime({
      logger: (msg) => logs.push(msg),
    });

    worker.registerCleanupHandler(async () => {
      throw new Error("Cleanup DB pool failed");
    });

    await worker.start();
    await worker.stop("test");

    expect(worker.getState()).toBe("stopped");
    expect(logs).toContain(
      "[Worker] Error during cleanup handler: Cleanup DB pool failed",
    );
  });

  it("attaches and detaches process signal handlers cleanly", () => {
    const worker = new WorkerRuntime();
    const unbind = worker.setupSignalHandlers();
    expect(typeof unbind).toBe("function");
    unbind();
  });
});
