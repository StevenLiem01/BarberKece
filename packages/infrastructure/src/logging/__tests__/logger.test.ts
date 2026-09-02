import { describe, expect, it } from "vitest";
import {
  createChildLogger,
  createLogger,
  createRequestLogger,
} from "../logger.js";
import { REDACTED_VALUE } from "../redact.js";

// Helper to capture structured logs from Pino destination stream
function createTestLogCapture() {
  const chunks: string[] = [];
  const destination = {
    write(chunk: string) {
      chunks.push(chunk);
    },
  };

  const parseLogs = (): Record<string, unknown>[] => {
    return chunks.map((c) => JSON.parse(c) as Record<string, unknown>);
  };

  return { destination, parseLogs, getRawLogs: () => chunks };
}

describe("Structured Logger Foundation", () => {
  it("emits structured JSON log entries with base fields and timestamp", () => {
    const { destination, parseLogs } = createTestLogCapture();
    const logger = createLogger({
      destination,
      module: "test-module",
      environment: "test",
    });

    logger.info({ operation: "test-op" }, "Structured log message");

    const logs = parseLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.service).toBe("barberkece");
    expect(logs[0]?.env).toBe("test");
    expect(logs[0]?.module).toBe("test-module");
    expect(logs[0]?.operation).toBe("test-op");
    expect(logs[0]?.msg).toBe("Structured log message");
    expect(logs[0]?.time).toBeDefined();
  });

  describe("Sensitive Data Redaction", () => {
    it("redacts passwords, passwordHash, and secrets at root and shallow depth", () => {
      const { destination, parseLogs, getRawLogs } = createTestLogCapture();
      const logger = createLogger({ destination });

      logger.info(
        {
          password: "super_secret_password",
          passwordHash: "$argon2id$v=19$m=65536...",
          secret: "top_secret_key",
          apiKey: "private_api_key_12345",
        },
        "User credentials logged",
      );

      const log = parseLogs()[0]!;
      expect(log.password).toBe(REDACTED_VALUE);
      expect(log.passwordHash).toBe(REDACTED_VALUE);
      expect(log.secret).toBe(REDACTED_VALUE);
      expect(log.apiKey).toBe(REDACTED_VALUE);

      const raw = getRawLogs()[0]!;
      expect(raw).not.toContain("super_secret_password");
      expect(raw).not.toContain("$argon2id$v=19$m=65536...");
      expect(raw).not.toContain("top_secret_key");
      expect(raw).not.toContain("private_api_key_12345");
    });

    it("redacts deeply nested sensitive properties across arbitrary structures", () => {
      const { destination, parseLogs, getRawLogs } = createTestLogCapture();
      const logger = createLogger({ destination });

      const deepPassword = "raw_nested_user_password_999";
      const deepResetToken = "raw_event_reset_token_888";
      const deepApiKey = "raw_metadata_provider_api_key_777";
      const deepSessionToken = "raw_session_token_666";

      logger.info(
        {
          request: {
            body: {
              user: {
                password: deepPassword,
              },
            },
          },
          event: {
            payload: {
              credentials: {
                resetToken: deepResetToken,
              },
            },
          },
          metadata: {
            provider: {
              apiKey: deepApiKey,
            },
          },
          auth: {
            session: {
              token: deepSessionToken,
            },
          },
        },
        "Deep nested payload",
      );

      const log = parseLogs()[0] as {
        request: { body: { user: { password: string } } };
        event: { payload: { credentials: { resetToken: string } } };
        metadata: { provider: { apiKey: string } };
        auth: { session: { token: string } };
      };

      expect(log.request.body.user.password).toBe(REDACTED_VALUE);
      expect(log.event.payload.credentials.resetToken).toBe(REDACTED_VALUE);
      expect(log.metadata.provider.apiKey).toBe(REDACTED_VALUE);
      expect(log.auth.session.token).toBe(REDACTED_VALUE);

      // Verify raw serialized string contains zero sensitive values
      const raw = getRawLogs()[0]!;
      expect(raw).not.toContain(deepPassword);
      expect(raw).not.toContain(deepResetToken);
      expect(raw).not.toContain(deepApiKey);
      expect(raw).not.toContain(deepSessionToken);
    });

    it("redacts authorization and cookie headers", () => {
      const { destination, parseLogs, getRawLogs } = createTestLogCapture();
      const logger = createLogger({ destination });

      logger.info(
        {
          headers: {
            authorization: "Bearer secret_bearer_token",
            cookie: "session=abc123secret; auth=xyz",
            "set-cookie": "token=new_token; HttpOnly",
          },
        },
        "HTTP request headers",
      );

      const log = parseLogs()[0] as {
        headers: {
          authorization: string;
          cookie: string;
          "set-cookie": string;
        };
      };

      expect(log.headers.authorization).toBe(REDACTED_VALUE);
      expect(log.headers.cookie).toBe(REDACTED_VALUE);
      expect(log.headers["set-cookie"]).toBe(REDACTED_VALUE);

      const raw = getRawLogs()[0]!;
      expect(raw).not.toContain("secret_bearer_token");
      expect(raw).not.toContain("session=abc123secret");
    });

    it("redacts email body content and private payload artifacts", () => {
      const { destination, parseLogs, getRawLogs } = createTestLogCapture();
      const logger = createLogger({ destination });

      logger.info(
        {
          emailBody: "Sensitive reset token url here",
          signedUrl: "https://r2.barberkece.com/private/signed?token=xyz",
          proofUrl: "https://storage.local/proofs/pay.jpg",
          cameraFrames: "[binary camera stream]",
          landmarks: [1, 2, 3, 4],
          previewBytes: "[raw image bytes]",
        },
        "Media and outbox event",
      );

      const log = parseLogs()[0]!;
      expect(log.emailBody).toBe(REDACTED_VALUE);
      expect(log.signedUrl).toBe(REDACTED_VALUE);
      expect(log.proofUrl).toBe(REDACTED_VALUE);
      expect(log.cameraFrames).toBe(REDACTED_VALUE);
      expect(log.landmarks).toBe(REDACTED_VALUE);
      expect(log.previewBytes).toBe(REDACTED_VALUE);

      const raw = getRawLogs()[0]!;
      expect(raw).not.toContain("Sensitive reset token url here");
      expect(raw).not.toContain("https://r2.barberkece.com/private/signed");
    });
  });

  describe("Child Loggers and Scoped Request Logging", () => {
    it("creates child loggers bound with persistent context fields", () => {
      const { destination, parseLogs } = createTestLogCapture();
      const rootLogger = createLogger({ destination, module: "core" });
      const childLogger = createChildLogger(rootLogger, {
        module: "reservation",
        actorId: "usr_123",
      });

      childLogger.info({ appointmentId: "apt_456" }, "Appointment created");

      const log = parseLogs()[0]!;
      expect(log.module).toBe("reservation");
      expect(log.actorId).toBe("usr_123");
      expect(log.appointmentId).toBe("apt_456");
      expect(log.service).toBe("barberkece");
    });

    it("creates request loggers with sanitized request IDs", () => {
      const { destination, parseLogs } = createTestLogCapture();
      const rootLogger = createLogger({ destination });

      const reqLogger = createRequestLogger(rootLogger, {
        requestId: "req_inbound-test-789",
        path: "/api/v1/appointments",
        method: "POST",
      });

      reqLogger.info("Incoming booking request");

      const log = parseLogs()[0]!;
      expect(log.requestId).toBe("req_inbound-test-789");
      expect(log.path).toBe("/api/v1/appointments");
      expect(log.method).toBe("POST");
    });

    it("createRequestLogger generates a fresh request ID if incoming is invalid", () => {
      const { destination, parseLogs } = createTestLogCapture();
      const rootLogger = createLogger({ destination });

      const reqLogger = createRequestLogger(rootLogger, {
        requestId: "<invalid_injection_id>",
      });

      reqLogger.info("Request processed");

      const log = parseLogs()[0]!;
      expect(log.requestId).toMatch(/^req_/);
      expect(log.requestId).not.toBe("<invalid_injection_id>");
    });
  });
});
