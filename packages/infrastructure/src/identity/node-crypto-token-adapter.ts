import * as crypto from "node:crypto";
import { TokenPort, TokenError } from "@barberkece/core/identity";

/**
 * Node.js Crypto token adapter for generating and hashing secure tokens.
 *
 * This adapter uses standard Node.js crypto primitives:
 * - Token Generation: 32 bytes (256-bit entropy) of cryptographically secure random data,
 *   encoded as base64url for safe use in cookies and URLs.
 * - Token Hashing: SHA-256 for deterministic hashing before database persistence.
 *
 * NOTE: This adapter relies on the Node.js native `crypto` module.
 * It is fully compatible with standard Node environments (including Vercel Serverless Functions)
 * but cannot be used in environments lacking Node's native `crypto` API (like the Vercel Edge Runtime)
 * without polyfills, which are generally not recommended for security primitives.
 */
export class NodeCryptoTokenAdapter implements TokenPort {
  async generateToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(32, (err, buffer) => {
        if (err) {
          reject(new TokenError("Failed to generate secure random token"));
          return;
        }
        resolve(buffer.toString("base64url"));
      });
    });
  }

  async hashToken(rawToken: string): Promise<string> {
    try {
      if (!rawToken || typeof rawToken !== "string") {
        throw new Error("Invalid raw token input");
      }
      return crypto.createHash("sha256").update(rawToken).digest("hex");
    } catch {
      throw new TokenError("Failed to hash token securely");
    }
  }
}
