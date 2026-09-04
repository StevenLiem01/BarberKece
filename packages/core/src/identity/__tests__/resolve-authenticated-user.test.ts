import { describe, it, expect, vi, beforeEach } from "vitest";
import { ResolveAuthenticatedUserUseCase } from "../use-cases/resolve-authenticated-user.js";
import { User } from "../models/user.js";
import { Session } from "../models/session.js";

describe("ResolveAuthenticatedUserUseCase", () => {
  const mockUserRepository = {
    createUser: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    countByRole: vi.fn(),
  };

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

  let useCase: ResolveAuthenticatedUserUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ResolveAuthenticatedUserUseCase(
      mockUserRepository,
      mockTokenPort,
      mockSessionRepository,
    );
  });

  const validUser: User = {
    id: "user-123",
    email: "test@example.com",
    role: "CUSTOMER",
    status: "ACTIVE",
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validSession: Session = {
    id: "session-123",
    userId: "user-123",
    tokenHash: "hashed-secret-token",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 1000000), // future
  };

  it("resolves authenticated user for a valid session", async () => {
    mockTokenPort.hashToken.mockResolvedValue("hashed-secret-token");
    mockSessionRepository.findActiveSessionByTokenHash.mockResolvedValue(
      validSession,
    );
    mockUserRepository.findById.mockResolvedValue({
      ...validUser,
      passwordHash: "secret",
    }); // Mock user with passwordHash to ensure it is stripped

    const result = await useCase.execute("raw-token");

    expect(mockTokenPort.hashToken).toHaveBeenCalledWith("raw-token");
    expect(
      mockSessionRepository.findActiveSessionByTokenHash,
    ).toHaveBeenCalledWith("hashed-secret-token");
    expect(mockUserRepository.findById).toHaveBeenCalledWith("user-123");

    // passwordHash should be stripped
    expect(result).toEqual(validUser);
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("returns null for missing or empty token", async () => {
    expect(await useCase.execute(null)).toBeNull();
    expect(await useCase.execute("")).toBeNull();
    expect(await useCase.execute(undefined)).toBeNull();

    expect(mockTokenPort.hashToken).not.toHaveBeenCalled();
  });

  it("returns null if session is not found", async () => {
    mockTokenPort.hashToken.mockResolvedValue("hashed-secret-token");
    mockSessionRepository.findActiveSessionByTokenHash.mockResolvedValue(null);

    const result = await useCase.execute("raw-token");
    expect(result).toBeNull();
    expect(mockUserRepository.findById).not.toHaveBeenCalled();
  });

  it("returns null if session is expired (repository returns null per contract)", async () => {
    mockTokenPort.hashToken.mockResolvedValue("hashed-secret-token");
    // SessionRepository contract guarantees expired sessions return null
    mockSessionRepository.findActiveSessionByTokenHash.mockResolvedValue(null);

    const result = await useCase.execute("raw-token");
    expect(result).toBeNull();
    expect(mockUserRepository.findById).not.toHaveBeenCalled();
  });

  it("does not independently evaluate expiresAt (trusts repository active session contract)", async () => {
    // If repository returned a session (even with older timestamp), use case trusts repository contract
    const sessionWithPastTimestamp: Session = {
      ...validSession,
      expiresAt: new Date(Date.now() - 10000),
    };
    mockTokenPort.hashToken.mockResolvedValue("hashed-secret-token");
    mockSessionRepository.findActiveSessionByTokenHash.mockResolvedValue(
      sessionWithPastTimestamp,
    );
    mockUserRepository.findById.mockResolvedValue(validUser);

    const result = await useCase.execute("raw-token");
    expect(result).toEqual(validUser);
    expect(mockUserRepository.findById).toHaveBeenCalledWith(
      sessionWithPastTimestamp.userId,
    );
  });

  it("returns null if user is not found", async () => {
    mockTokenPort.hashToken.mockResolvedValue("hashed-secret-token");
    mockSessionRepository.findActiveSessionByTokenHash.mockResolvedValue(
      validSession,
    );
    mockUserRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute("raw-token");
    expect(result).toBeNull();
  });

  it("returns null if user is inactive", async () => {
    mockTokenPort.hashToken.mockResolvedValue("hashed-secret-token");
    mockSessionRepository.findActiveSessionByTokenHash.mockResolvedValue(
      validSession,
    );
    mockUserRepository.findById.mockResolvedValue({
      ...validUser,
      status: "BANNED",
    });

    const result = await useCase.execute("raw-token");
    expect(result).toBeNull();
  });
});
