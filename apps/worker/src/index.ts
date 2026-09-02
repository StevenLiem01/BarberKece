import { WorkerRuntime } from "./worker.js";

const worker = new WorkerRuntime();

worker.setupSignalHandlers();

worker.start().catch((error) => {
  console.error("[BarberKece Worker] Fatal startup error:", error);
  process.exit(1);
});

export { worker, WorkerRuntime };
