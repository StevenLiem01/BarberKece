import { describe, it, expect } from "vitest";
import { NodeCryptoTokenAdapter } from "../node-crypto-token-adapter.js";
import { TokenError } from "@barberkece/core/identity";

describe("NodeCryptoTokenAdapter", () => {
  const adapter = new NodeCryptoTokenAdapter();

  describe("generateToken", () => {
    it("should generate a non-empty token", async () => {
      const token = await adapter.generateToken();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("should generate different tokens each time", async () => {
      const token1 = await adapter.generateToken();
      const token2 = await adapter.generateToken();
      expect(token1).not.toBe(token2);
    });

    it("should generate tokens that are URL/cookie safe (base64url)", async () => {
      const token = await adapter.generateToken();
      // base64url characters only: A-Z, a-z, 0-9, -, _
      // Node's base64url encoding drops padding '='
      expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
    });

    it("should have a stable length (43 chars for 32 bytes base64url)", async () => {
      const token = await adapter.generateToken();
      expect(token.length).toBe(43);
    });
  });

  describe("hashToken", () => {
    it("should generate a stable hash for the same token", async () => {
      const token = "my-secure-token-123";
      const hash1 = await adapter.hashToken(token);
      const hash2 = await adapter.hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different tokens", async () => {
      const hash1 = await adapter.hashToken("token-a");
      const hash2 = await adapter.hashToken("token-b");
      expect(hash1).not.toBe(hash2);
    });

    it("should generate a hex string of exactly 64 characters (SHA-256)", async () => {
      const hash = await adapter.hashToken("test-token");
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });

    it("should safely handle invalid inputs without exposing them", async () => {
      try {
        await adapter.hashToken(null as unknown as string);
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(TokenError);
        if (error instanceof TokenError) {
          expect(error.name).toBe("TokenError");
          expect(error.message).toBe("Failed to hash token securely");
          expect(error.message).not.toContain("null");
        }
      }
    });
  });
});
