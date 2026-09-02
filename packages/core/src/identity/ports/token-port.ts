export interface TokenPort {
  /**
   * Generates a cryptographically secure, high-entropy, URL-safe raw token.
   * This raw token should be sent to the user/client but NEVER stored in the database.
   */
  generateToken(): Promise<string>;

  /**
   * Generates a deterministic hash of a raw token for database storage and lookup.
   * This hash is what should be persisted and queried against.
   *
   * @param rawToken The raw token string to hash.
   */
  hashToken(rawToken: string): Promise<string>;
}
