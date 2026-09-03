import { describe, it, expect, vi, beforeEach } from "vitest";
import { RevokeSessionUseCase } from "../use-cases/revoke-session.js";

describe("RevokeSessionUseCase", () => {
  const mockTokenPort = {
    generateToken: vi.fn(),
    hashToken: vi.fn(),
  };

  const mockSessionRepository = {
    createSession: vi.fn(),
    findActiveSessionByTokenHash: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllSessionsForUser: vi.fn(),
  };

  let useCase: RevokeSessionUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new RevokeSessionUseCase(mockTokenPort, mockSessionRepository);
  });

  it("hashes raw token and revokes session via repository", async () => {
    mockTokenPort.hashToken.mockResolvedValue("hashed-token-123");
    mockSessionRepository.revokeSession.mockResolvedValue(undefined);

    await useCase.execute("raw-token-abc");

    expect(mockTokenPort.hashToken).toHaveBeenCalledWith("raw-token-abc");
    expect(mockSessionRepository.revokeSession).toHaveBeenCalledWith(
      "hashed-token-123",
    );
    // Revoke is strictly called with tokenHash, never raw token
    expect(mockSessionRepository.revokeSession).not.toHaveBeenCalledWith(
      "raw-token-abc",
    );
  });

  it("is safe and idempotent for missing or empty tokens", async () => {
    await expect(useCase.execute(null)).resolves.toBeUndefined();
    await expect(useCase.execute(undefined)).resolves.toBeUndefined();
    await expect(useCase.execute("")).resolves.toBeUndefined();
    await expect(
      useCase.execute(123 as unknown as string),
    ).resolves.toBeUndefined();

    expect(mockTokenPort.hashToken).not.toHaveBeenCalled();
    expect(mockSessionRepository.revokeSession).not.toHaveBeenCalled();
  });

  it("is safe on repeated or nonexistent session revocation", async () => {
    mockTokenPort.hashToken.mockResolvedValue("hashed-nonexistent-token");
    mockSessionRepository.revokeSession.mockResolvedValue(undefined);

    await expect(useCase.execute("nonexistent-token")).resolves.toBeUndefined();
    await expect(useCase.execute("nonexistent-token")).resolves.toBeUndefined();

    expect(mockTokenPort.hashToken).toHaveBeenCalledTimes(2);
    expect(mockSessionRepository.revokeSession).toHaveBeenCalledTimes(2);
  });

  it("propagates error if TokenPort fails", async () => {
    const cryptoError = new Error("Token hashing failed");
    mockTokenPort.hashToken.mockRejectedValue(cryptoError);

    await expect(useCase.execute("raw-token")).rejects.toThrow(
      "Token hashing failed",
    );
    expect(mockSessionRepository.revokeSession).not.toHaveBeenCalled();
  });

  it("propagates error if SessionRepository fails", async () => {
    mockTokenPort.hashToken.mockResolvedValue("hashed-token");
    const dbError = new Error("Database error during session revocation");
    mockSessionRepository.revokeSession.mockRejectedValue(dbError);

    await expect(useCase.execute("raw-token")).rejects.toThrow(
      "Database error during session revocation",
    );
    expect(mockTokenPort.hashToken).toHaveBeenCalledWith("raw-token");
    expect(mockSessionRepository.revokeSession).toHaveBeenCalledWith(
      "hashed-token",
    );
  });
});
