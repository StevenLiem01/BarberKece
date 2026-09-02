export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  messageId: string;
  deliveredAt: Date;
}

/**
 * EmailPort defines the contract for sending transactional and operational emails.
 * Implementations (Console in dev, Resend in prod) live in infrastructure.
 */
export interface EmailPort {
  /**
   * Send an email message. Returns delivery confirmation metadata.
   */
  sendEmail(message: EmailMessage): Promise<SendEmailResult>;
}
