import pino, {
  type DestinationStream,
  type Logger as PinoLogger,
  type LoggerOptions as PinoLoggerOptions,
} from "pino";
import { DEFAULT_REDACT_PATHS, REDACTED_VALUE } from "./redact.js";
import { sanitizeRequestId } from "./request-id.js";

export type Logger = PinoLogger;

export interface LogContext {
  requestId?: string;
  correlationId?: string;
  module?: string;
  operation?: string;
  actorId?: string;
  resourceId?: string;
  [key: string]: unknown;
}

export interface LoggerOptions {
  /**
   * Logging level (e.g. 'debug', 'info', 'warn', 'error'). Defaults to LOG_LEVEL env or 'info'.
   */
  level?: string;
  /**
   * Logical module or service name.
   */
  module?: string;
  /**
   * Environment name (e.g. 'development', 'production', 'test').
   */
  environment?: string;
  /**
   * Custom destination stream (primarily used in unit testing to capture structured JSON logs).
   */
  destination?: DestinationStream;
  /**
   * Additional paths to redact.
   */
  additionalRedactPaths?: string[];
}

/**
 * Creates a structured Pino logger instance pre-configured with BarberKece standards:
 * - Central redaction for credentials, tokens, cookies, secrets, and auth headers
 * - Standard base fields (service, environment, module)
 * - ISO timestamp format
 */
export function createLogger(options?: LoggerOptions): Logger {
  const level = options?.level ?? process.env.LOG_LEVEL ?? "info";
  const environment =
    options?.environment ?? process.env.NODE_ENV ?? "development";

  const redactPaths = [
    ...DEFAULT_REDACT_PATHS,
    ...(options?.additionalRedactPaths ?? []),
  ];

  const pinoConfig: PinoLoggerOptions = {
    level,
    base: {
      service: "barberkece",
      env: environment,
      ...(options?.module ? { module: options.module } : {}),
    },
    redact: {
      paths: redactPaths,
      censor: REDACTED_VALUE,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (options?.destination) {
    return pino(pinoConfig, options.destination);
  }

  return pino(pinoConfig);
}

/**
 * Creates a child logger bound to specific context (e.g., requestId, module, actorId).
 */
export function createChildLogger(
  parentLogger: Logger,
  context: LogContext,
): Logger {
  return parentLogger.child(context);
}

/**
 * Creates a scoped request logger with a verified requestId for HTTP handlers or background tasks.
 */
export function createRequestLogger(
  parentLogger: Logger,
  context: {
    requestId?: string | string[] | null;
    module?: string;
    operation?: string;
    actorId?: string;
    path?: string;
    method?: string;
    [key: string]: unknown;
  },
): Logger {
  const { requestId: rawRequestId, ...rest } = context;
  const requestId = sanitizeRequestId(rawRequestId);

  return parentLogger.child({
    requestId,
    ...rest,
  });
}

/**
 * Default global logger instance for @barberkece/infrastructure.
 */
export const logger: Logger = createLogger();
