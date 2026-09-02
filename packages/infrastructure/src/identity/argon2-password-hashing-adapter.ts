import * as argon2 from "argon2";
import { PasswordHashingPort } from "@barberkece/core/identity";
import { PasswordHashingError } from "@barberkece/core/identity";

/**
 * Argon2id password hashing adapter.
 *
 * Parameters Chosen for Interactive Web App:
 * - type: argon2.argon2id (OWASP recommended standard)
 * - memoryCost: 65536 KB (64 MB) - Balances Vercel Server runtime memory limits (often 1024MB or 512MB) while preventing GPU/ASIC attacks.
 * - timeCost: 3 - Sufficient computational iterations given the memory cost.
 * - parallelism: 4 - Leverages modern multi-threading, within typical serverless execution capabilities.
 *
 * These parameters satisfy OWASP recommendations for interactive logins without causing
 * memory exhaustion or unacceptable latency in serverless environments.
 */
export class Argon2PasswordHashingAdapter implements PasswordHashingPort {
  private readonly options = {
    type: 2 as const, // argon2.argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  };

  async hashPassword(plainPassword: string): Promise<string> {
    try {
      return await argon2.hash(plainPassword, this.options);
    } catch {
      throw new PasswordHashingError("Failed to hash password safely");
    }
  }

  async verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
    try {
      // argon2.verify handles malformed hashes safely by throwing an error or returning false.
      // We catch any potential errors and return false to fail securely.
      return await argon2.verify(hash, plainPassword);
    } catch {
      return false; // Safely handle malformed or unsupported hashes
    }
  }
}
