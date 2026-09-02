import { createLogger, type Logger } from "@barberkece/infrastructure";

export type WorkerState = "idle" | "running" | "stopping" | "stopped";

export type CleanupHandler = () => Promise<void> | void;

export type CustomLogFn = (message: string) => void;

export interface WorkerOptions {
  /**
   * Interval in milliseconds for idle worker heartbeat/tick (default: 5000ms).
   */
  tickIntervalMs?: number;
  /**
   * Custom logger instance or simple log function.
   */
  logger?: Logger | CustomLogFn;
  /**
   * Timeout in ms for graceful shutdown cleanup (default: 10000ms).
   */
  shutdownTimeoutMs?: number;
}

/**
 * WorkerRuntime
 * Manages the lifecycle, background loop, and graceful shutdown of the BarberKece worker.
 */
export class WorkerRuntime {
  private state: WorkerState = "idle";
  private readonly tickIntervalMs: number;
  private readonly shutdownTimeoutMs: number;
  private readonly loggerInstance: Logger | CustomLogFn;
  private readonly cleanupHandlers: CleanupHandler[] = [];
  private tickTimer: NodeJS.Timeout | null = null;
  private abortController: AbortController | null = null;

  constructor(options?: WorkerOptions) {
    this.tickIntervalMs = options?.tickIntervalMs ?? 5000;
    this.shutdownTimeoutMs = options?.shutdownTimeoutMs ?? 10000;
    this.loggerInstance = options?.logger ?? createLogger({ module: "worker" });
  }

  private logInfo(message: string, context?: Record<string, unknown>): void {
    if (typeof this.loggerInstance === "function") {
      this.loggerInstance(message);
    } else {
      if (context) {
        this.loggerInstance.info(context, message);
      } else {
        this.loggerInstance.info(message);
      }
    }
  }

  private logError(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    if (typeof this.loggerInstance === "function") {
      this.loggerInstance(`${message}${error ? `: ${error.message}` : ""}`);
    } else {
      this.loggerInstance.error({ err: error, ...context }, message);
    }
  }

  /**
   * Returns the current lifecycle state of the worker.
   */
  getState(): WorkerState {
    return this.state;
  }

  /**
   * Returns true if the worker is currently running.
   */
  isRunning(): boolean {
    return this.state === "running";
  }

  /**
   * Registers a cleanup handler to be executed during graceful shutdown.
   */
  registerCleanupHandler(handler: CleanupHandler): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Starts the worker process and its background lifecycle loop.
   */
  async start(): Promise<void> {
    if (this.state === "running") {
      this.logInfo("[Worker] Worker is already running.");
      return;
    }
    if (this.state === "stopping") {
      throw new Error("Cannot start worker while it is stopping.");
    }

    this.state = "running";
    this.abortController = new AbortController();
    this.logInfo("[Worker] Starting BarberKece Worker process...");

    this.scheduleNextTick();
    this.logInfo("[Worker] Worker successfully started.");
  }

  private scheduleNextTick(): void {
    if (this.state !== "running") return;

    this.tickTimer = setTimeout(async () => {
      if (this.state !== "running") return;
      try {
        await this.onTick();
      } catch (error) {
        this.logError("[Worker] Error during worker tick", error as Error);
      } finally {
        this.scheduleNextTick();
      }
    }, this.tickIntervalMs);

    // Unref timer so it doesn't prevent process exit if everything else stops
    if (this.tickTimer && typeof this.tickTimer.unref === "function") {
      this.tickTimer.unref();
    }
  }

  /**
   * Placeholder hook for future outbox / scheduled task processing.
   */
  protected async onTick(): Promise<void> {
    // M0 bootstrap: heartbeat tick without DB or outbox operations
  }

  /**
   * Initiates graceful shutdown, running all registered cleanup handlers.
   */
  async stop(reason = "manual"): Promise<void> {
    if (this.state === "stopping" || this.state === "stopped") {
      return;
    }

    this.state = "stopping";
    this.logInfo(
      `[Worker] Initiating graceful shutdown (reason: ${reason})...`,
    );

    // Cancel pending ticks and signal abort
    if (this.tickTimer) {
      clearTimeout(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Execute cleanup handlers with timeout protection
    const cleanupPromise = (async () => {
      for (const handler of this.cleanupHandlers) {
        try {
          await handler();
        } catch (error) {
          this.logError(
            "[Worker] Error during cleanup handler",
            error as Error,
          );
        }
      }
    })();

    const timeoutPromise = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.logInfo(
          `[Worker] Cleanup exceeded ${this.shutdownTimeoutMs}ms timeout; proceeding with shutdown.`,
        );
        resolve();
      }, this.shutdownTimeoutMs);
      if (typeof timer.unref === "function") timer.unref();
    });

    await Promise.race([cleanupPromise, timeoutPromise]);

    this.state = "stopped";
    this.logInfo("[Worker] Worker shutdown complete.");
  }

  /**
   * Binds SIGINT and SIGTERM OS signals to trigger graceful shutdown.
   * Returns an unbind function.
   */
  setupSignalHandlers(): () => void {
    const onSignal = async (signal: string) => {
      this.logInfo(`[Worker] Received ${signal} signal.`);
      await this.stop(signal);
      process.exit(0);
    };

    const sigintHandler = () => onSignal("SIGINT");
    const sigtermHandler = () => onSignal("SIGTERM");

    process.on("SIGINT", sigintHandler);
    process.on("SIGTERM", sigtermHandler);

    return () => {
      process.off("SIGINT", sigintHandler);
      process.off("SIGTERM", sigtermHandler);
    };
  }
}
