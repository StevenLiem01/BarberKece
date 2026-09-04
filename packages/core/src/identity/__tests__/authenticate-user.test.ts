import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthenticateUserUseCase } from "../use-cases/authenticate-user.js";
import { AuthenticationError } from "../errors.js";
import { UserWithPasswordHash } from "../models/user.js";

describe("AuthenticateUserUseCase", () => {
  const mockUserRepository = {
    createUser: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    countByRole: vi.fn(),
  };

  const mockPasswordHashing = {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
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

  let useCase: AuthenticateUserUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new AuthenticateUserUseCase(
      mockUserRepository,
      mockPasswordHashing,
      mockTokenPort,
      mockSessionRepository,
    );
  });

  const validUser: UserWithPasswordHash = {
    id: "user-123",
    email: "test@example.com",
    passwordHash: "hashed-pass",
    role: "CUSTOMER",
    status: "ACTIVE",
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("authenticates valid credentials, creates session, and returns token", async () => {
    mockUserRepository.findByEmail.mockResolvedValue(validUser);
    mockPasswordHashing.verifyPassword.mockResolvedValue(true);
    mockTokenPort.generateToken.mockResolvedValue("raw-secret-token");
    mockTokenPort.hashToken.mockResolvedValue("hashed-secret-token");

    // We expect session repository to be called with hash, not raw token
    mockSessionRepository.createSession.mockImplementation(async (s) => s);

    const result = await useCase.execute({
      email: " Test@example.com ", // Tests normalization
      passwordRaw: "correct-password",
    });

    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
      "test@example.com",
    );
    expect(mockPasswordHashing.verifyPassword).toHaveBeenCalledWith(
      "hashed-pass",
      "correct-password",
    );

    // Verify session creation
    expect(mockSessionRepository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        tokenHash: "hashed-secret-token", // Raw token MUST NOT be persisted
      }),
    );

    // Verify token was hashed
    expect(mockTokenPort.hashToken).toHaveBeenCalledWith("raw-secret-token");

    // Check expiry logic (7 days)
    const sessionCall = mockSessionRepository.createSession.mock.calls[0][0];
    const diff =
      sessionCall.expiresAt.getTime() - sessionCall.createdAt.getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000); // exactly 7 days

    // Verify output (safe user, raw token)
    expect(result.rawToken).toBe("raw-secret-token");
    expect(result.user).toEqual({
      id: validUser.id,
      email: validUser.email,
      role: validUser.role,
      status: validUser.status,
      emailVerifiedAt: validUser.emailVerifiedAt,
      lastLoginAt: validUser.lastLoginAt,
      createdAt: validUser.createdAt,
      updatedAt: validUser.updatedAt,
    });
    expect(result.expiresAt).toEqual(sessionCall.expiresAt);
  });

  it("rejects unknown email identically without exposing it and runs dummy hash", async () => {
    mockUserRepository.findByEmail.mockResolvedValue(null);
    mockPasswordHashing.verifyPassword.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: "unknown@example.com", passwordRaw: "pass" }),
    ).rejects.toThrow(AuthenticationError);
    await expect(
      useCase.execute({ email: "unknown@example.com", passwordRaw: "pass" }),
    ).rejects.toThrow("Invalid email or password");

    // Structural proof of timing-attack mitigation:
    // It must call verifyPassword with the dummy hash
    expect(mockPasswordHashing.verifyPassword).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$v=19\$m=65536,p=4,t=3\$.+/),
      "pass",
    );

    expect(mockSessionRepository.createSession).not.toHaveBeenCalled();
    expect(mockTokenPort.generateToken).not.toHaveBeenCalled();
  });

  it("rejects wrong password identically without exposing it", async () => {
    mockUserRepository.findByEmail.mockResolvedValue(validUser);
    mockPasswordHashing.verifyPassword.mockResolvedValue(false);

    await expect(
      useCase.execute({ email: "test@example.com", passwordRaw: "wrong" }),
    ).rejects.toThrow(AuthenticationError);
    await expect(
      useCase.execute({ email: "test@example.com", passwordRaw: "wrong" }),
    ).rejects.toThrow("Invalid email or password");

    expect(mockSessionRepository.createSession).not.toHaveBeenCalled();
  });

  it("rejects inactive accounts safely", async () => {
    const inactiveUser = { ...validUser, status: "BANNED" };
    mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);
    mockPasswordHashing.verifyPassword.mockResolvedValue(true);

    await expect(
      useCase.execute({
        email: "test@example.com",
        passwordRaw: "correct-password",
      }),
    ).rejects.toThrow(AuthenticationError);
    await expect(
      useCase.execute({
        email: "test@example.com",
        passwordRaw: "correct-password",
      }),
    ).rejects.toThrow("Account is inactive");

    expect(mockSessionRepository.createSession).not.toHaveBeenCalled();
  });
});
