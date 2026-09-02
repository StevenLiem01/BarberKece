import { describe, it, expect } from "vitest";
import { PasswordHashingError } from "@barberkece/core/identity";
import { Argon2PasswordHashingAdapter } from "../argon2-password-hashing-adapter.js";

describe("Argon2PasswordHashingAdapter", () => {
  const adapter = new Argon2PasswordHashingAdapter();

  it("should successfully hash a password", async () => {
    const plain = "SuperSecretPassword123!";
    const hash = await adapter.hashPassword(plain);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(plain);
    // Argon2 hashes in the standard PHC format start with $argon2
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("should generate different hashes for the same password due to random salting", async () => {
    const plain = "AnotherSecret123!";
    const hash1 = await adapter.hashPassword(plain);
    const hash2 = await adapter.hashPassword(plain);

    expect(hash1).not.toBe(hash2);
  });

  it("should successfully verify a correct password", async () => {
    const plain = "VerifyThis123!";
    const hash = await adapter.hashPassword(plain);

    const isValid = await adapter.verifyPassword(hash, plain);
    expect(isValid).toBe(true);
  });

  it("should reject an incorrect password", async () => {
    const plain = "RightPassword123!";
    const wrongPlain = "WrongPassword123!";
    const hash = await adapter.hashPassword(plain);

    const isValid = await adapter.verifyPassword(hash, wrongPlain);
    expect(isValid).toBe(false);
  });

  it("should safely fail when verifying a malformed hash", async () => {
    const plain = "Password123!";
    const malformedHash = "$argon2id$v=19$m=65536,t=3,p=4$MALFORMED$HASH";

    const isValid = await adapter.verifyPassword(malformedHash, plain);
    expect(isValid).toBe(false);
  });

  it("should not expose plaintext password in thrown errors", async () => {
    // We simulate a failure in hash generation.
    // The easiest way is to pass something invalid to the adapter if it wasn't typed,
    // but TypeScript protects us. Let's just mock argon2 internally or test the throw.
    // Given we can't easily mock native argon2 without messing up other tests,
    // we can rely on the fact that `hashPassword` catches errors and throws `PasswordHashingError`
    // which has a hardcoded safe string.
    try {
      // Intentionally passing null (bypassing TS) to trigger internal library throw
      await adapter.hashPassword(null as unknown as string);
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(PasswordHashingError);
      if (error instanceof PasswordHashingError) {
        expect(error.name).toBe("PasswordHashingError");
        expect(error.message).toBe("Failed to hash password safely");
        expect(error.message).not.toContain("null");
      }
    }
  });
});
