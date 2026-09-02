import * as crypto from "node:crypto";
import {
  type EmailMessage,
  type EmailPort,
  type SendEmailResult,
  InvalidEmailAddressError,
  InvalidEmailSubjectError,
  MissingEmailContentError,
} from "@barberkece/core";

export interface ConsoleEmailAdapterConfig {
  /**
   * Optional custom sink for safe metadata output (defaults to console.log).
   */
  sink?: (output: string) => void;
  /**
   * Default sender address if not specified in EmailMessage.
   */
  defaultFrom?: string;
}

/**
 * Masks an email address to protect PII in development logs.
 * Example: customer@example.com -> c***r@example.com
 */
function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return "***";

  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex + 1);

  if (localPart.length <= 2) {
    return `*@${domain}`;
  }

  const first = localPart[0];
  const last = localPart[localPart.length - 1];
  return `${first}***${last}@${domain}`;
}

/**
 * ConsoleEmailAdapter
 * Development email adapter implementing EmailPort by logging safe, minimal
 * metadata to a sink without sending real emails or exposing sensitive message bodies.
 */
export class ConsoleEmailAdapter implements EmailPort {
  private readonly sink: (output: string) => void;
  private readonly defaultFrom: string;

  constructor(config?: ConsoleEmailAdapterConfig) {
    this.sink = config?.sink ?? ((output: string) => console.log(output));
    this.defaultFrom = config?.defaultFrom ?? "no-reply@barberkece.local";
  }

  private validateRecipient(recipient: string): void {
    if (
      !recipient ||
      typeof recipient !== "string" ||
      recipient.trim() === ""
    ) {
      throw new InvalidEmailAddressError(
        "Recipient email address must be a non-empty string",
      );
    }
    const trimmed = recipient.trim();
    if (
      !trimmed.includes("@") ||
      trimmed.startsWith("@") ||
      trimmed.endsWith("@")
    ) {
      throw new InvalidEmailAddressError(
        `Invalid email address: '${recipient}'`,
      );
    }
  }

  async sendEmail(message: EmailMessage): Promise<SendEmailResult> {
    if (!message.subject || message.subject.trim() === "") {
      throw new InvalidEmailSubjectError();
    }

    if (!message.text && !message.html) {
      throw new MissingEmailContentError();
    }

    const rawRecipients = Array.isArray(message.to) ? message.to : [message.to];

    if (rawRecipients.length === 0) {
      throw new InvalidEmailAddressError(
        "At least one recipient must be specified",
      );
    }

    for (const recipient of rawRecipients) {
      this.validateRecipient(recipient);
    }

    const from = message.from ?? this.defaultFrom;
    const messageId = `dev_${crypto.randomUUID()}`;
    const deliveredAt = new Date();

    const maskedRecipients = rawRecipients.map((r) => maskEmail(r.trim()));

    // Safe development logging: never log body text, HTML, tokens, or headers
    const safeOutput = [
      "========== [DEV EMAIL ADAPTER] ==========",
      `Message ID : ${messageId}`,
      `Timestamp  : ${deliveredAt.toISOString()}`,
      `From       : ${maskEmail(from)}`,
      `To         : ${maskedRecipients.join(", ")} (${rawRecipients.length} recipient${rawRecipients.length > 1 ? "s" : ""})`,
      `Subject    : ${message.subject.trim()}`,
      `Payload    : [text=${Boolean(message.text)}, html=${Boolean(message.html)}] (body omitted for safety)`,
      "=========================================",
    ].join("\n");

    this.sink(safeOutput);

    return {
      messageId,
      deliveredAt,
    };
  }
}
