import { createLogger } from "@barberkece/infrastructure";
import { WorkerRuntime } from "./worker.js";

const logger = createLogger({ module: "worker" });
const worker = new WorkerRuntime({ logger });

worker.setupSignalHandlers();

worker.start().catch((error) => {
  logger.fatal({ err: error }, "[BarberKece Worker] Fatal startup error");
  process.exit(1);
});

export { worker, WorkerRuntime };
