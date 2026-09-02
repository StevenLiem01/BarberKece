import {
  InvalidEmailAddressError,
  InvalidEmailSubjectError,
  MissingEmailContentError,
} from "@barberkece/core";
import { describe, expect, it } from "vitest";
import { ConsoleEmailAdapter } from "../console-email-adapter.js";

describe("ConsoleEmailAdapter", () => {
  it("sends an email and logs only safe metadata without leaking text or html body", async () => {
    const logs: string[] = [];
    const adapter = new ConsoleEmailAdapter({
      sink: (output) => logs.push(output),
    });

    const sensitiveToken = "super_secret_password_reset_token_987654321";
    const sensitiveUrl = `https://barberkece.local/auth/reset?token=${sensitiveToken}`;
    const rawBody = `Click here to reset: ${sensitiveUrl}`;
    const rawHtml = `<p>Confidential reset code: <strong>998877</strong></p>`;

    const result = await adapter.sendEmail({
      to: "customer@example.com",
      subject: "Password Reset Request",
      text: rawBody,
      html: rawHtml,
    });

    expect(result.messageId).toMatch(/^dev_/);
    expect(result.deliveredAt).toBeInstanceOf(Date);
    expect(logs).toHaveLength(1);

    const logOutput = logs[0]!;

    // Safe metadata present
    expect(logOutput).toContain("Password Reset Request");
    expect(logOutput).toContain("c***r@example.com");
    expect(logOutput).toContain("text=true, html=true");
    expect(logOutput).toContain("(body omitted for safety)");

    // Sensitive message body content MUST NOT be logged
    expect(logOutput).not.toContain(sensitiveToken);
    expect(logOutput).not.toContain(sensitiveUrl);
    expect(logOutput).not.toContain("998877");
    expect(logOutput).not.toContain("Click here to reset");
    expect(logOutput).not.toContain("<p>Confidential");
  });

  it("masks recipient email addresses to protect PII in logs", async () => {
    const logs: string[] = [];
    const adapter = new ConsoleEmailAdapter({
      sink: (output) => logs.push(output),
    });

    await adapter.sendEmail({
      to: ["alexander@domain.com", "ab@short.org"],
      subject: "Schedule Update",
      text: "Booking details.",
    });

    expect(logs[0]).toContain("a***r@domain.com");
    expect(logs[0]).toContain("*@short.org");
    expect(logs[0]).toContain("2 recipients");
  });

  it("throws MissingEmailContentError if neither text nor html is provided", async () => {
    const adapter = new ConsoleEmailAdapter({ sink: () => {} });

    await expect(
      adapter.sendEmail({
        to: "user@example.com",
        subject: "No content",
      }),
    ).rejects.toThrow(MissingEmailContentError);
  });

  it("throws InvalidEmailSubjectError on empty or whitespace subject", async () => {
    const adapter = new ConsoleEmailAdapter({ sink: () => {} });

    await expect(
      adapter.sendEmail({
        to: "user@example.com",
        subject: "",
        text: "Some content",
      }),
    ).rejects.toThrow(InvalidEmailSubjectError);

    await expect(
      adapter.sendEmail({
        to: "user@example.com",
        subject: "    ",
        text: "Some content",
      }),
    ).rejects.toThrow(InvalidEmailSubjectError);
  });

  it("throws InvalidEmailAddressError on invalid or empty recipient addresses", async () => {
    const adapter = new ConsoleEmailAdapter({ sink: () => {} });

    await expect(
      adapter.sendEmail({
        to: "",
        subject: "Subject",
        text: "Content",
      }),
    ).rejects.toThrow(InvalidEmailAddressError);

    await expect(
      adapter.sendEmail({
        to: "invalid-email-no-at",
        subject: "Subject",
        text: "Content",
      }),
    ).rejects.toThrow(InvalidEmailAddressError);

    await expect(
      adapter.sendEmail({
        to: "@no-local.com",
        subject: "Subject",
        text: "Content",
      }),
    ).rejects.toThrow(InvalidEmailAddressError);

    await expect(
      adapter.sendEmail({
        to: "no-domain@",
        subject: "Subject",
        text: "Content",
      }),
    ).rejects.toThrow(InvalidEmailAddressError);

    await expect(
      adapter.sendEmail({
        to: [],
        subject: "Subject",
        text: "Content",
      }),
    ).rejects.toThrow(InvalidEmailAddressError);
  });
});
