import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequestPasswordResetUseCase } from "../use-cases/request-password-reset.js";
import { UserRepository } from "../ports/user-repository.js";
import { PasswordResetTokenRepository } from "../ports/password-reset-token-repository.js";
import { PasswordResetTransactionRunner } from "../ports/password-reset-transaction-runner.js";
import { SessionRepository } from "../ports/session-repository.js";
import { TokenPort } from "../ports/token-port.js";
import { EmailPort } from "../../email/ports/email-port.js";
import { IdentityError } from "../errors.js";
import { UserWithPasswordHash } from "../models/user.js";

describe("RequestPasswordResetUseCase", () => {
  const mockUserRepository: UserRepository = {
    createUser: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    countByRole: vi.fn(),
    updatePassword: vi.fn(),
  };

  const mockPasswordResetTokenRepository: PasswordResetTokenRepository = {
    acquireUserIssuanceLock: vi.fn(),
    createToken: vi.fn(),
    invalidateActiveTokensForUser: vi.fn(),
    findAndLockByTokenHash: vi.fn(),
    consumeToken: vi.fn(),
  };

  const mockSessionRepository: SessionRepository = {
    createSession: vi.fn(),
    findActiveSessionByTokenHash: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllSessionsForUser: vi.fn(),
  };

  const mockTransactionRunner: PasswordResetTransactionRunner = {
    run: vi.fn(async (work) =>
      work({
        userRepository: mockUserRepository,
        passwordResetTokenRepository: mockPasswordResetTokenRepository,
        sessionRepository: mockSessionRepository,
      }),
    ),
  };

  const mockTokenPort: TokenPort = {
    generateToken: vi.fn(),
    hashToken: vi.fn(),
  };

  const mockEmailPort: EmailPort = {
    sendEmail: vi.fn(),
  };

  const appUrl = "https://barberkece.id";

  let useCase: RequestPasswordResetUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new RequestPasswordResetUseCase(
      mockUserRepository,
      mockTransactionRunner,
      mockTokenPort,
      mockEmailPort,
      appUrl,
    );
  });

  const activeUser: UserWithPasswordHash = {
    id: "user-uuid-1",
    email: "customer@example.com",
    passwordHash: "hash",
    role: "CUSTOMER",
    status: "ACTIVE",
    emailVerifiedAt: new Date(),
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should throw IdentityError if email is empty or missing", async () => {
    await expect(useCase.execute({ email: "" })).rejects.toThrow(
      new IdentityError("Email is required"),
    );
    await expect(useCase.execute({ email: "   " })).rejects.toThrow(
      new IdentityError("Email is required"),
    );
  });

  it("should return generic success and trigger zero token creation or email side effects for unknown email", async () => {
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);

    const result = await useCase.execute({ email: "unknown@example.com" });

    expect(result.message).toBe(
      "If your email is registered, you will receive password reset instructions shortly.",
    );
    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
      "unknown@example.com",
    );
    expect(mockTokenPort.generateToken).not.toHaveBeenCalled();
    expect(mockTransactionRunner.run).not.toHaveBeenCalled();
    expect(mockEmailPort.sendEmail).not.toHaveBeenCalled();
  });

  it("should return generic success and trigger zero token creation for inactive/suspended users", async () => {
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue({
      ...activeUser,
      status: "SUSPENDED",
    });

    const result = await useCase.execute({ email: "suspended@example.com" });

    expect(result.message).toBe(
      "If your email is registered, you will receive password reset instructions shortly.",
    );
    expect(mockTokenPort.generateToken).not.toHaveBeenCalled();
    expect(mockTransactionRunner.run).not.toHaveBeenCalled();
    expect(mockEmailPort.sendEmail).not.toHaveBeenCalled();
  });

  it("should trim and lowercase email before lookup", async () => {
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);

    await useCase.execute({ email: "  Customer@Example.COM  " });

    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
      "customer@example.com",
    );
  });

  it("should execute locked issuance transaction and send email for known eligible user", async () => {
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(activeUser);
    vi.mocked(mockTokenPort.generateToken).mockResolvedValue(
      "raw-reset-token-xyz",
    );
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("hashed-token-xyz");
    vi.mocked(mockPasswordResetTokenRepository.createToken).mockResolvedValue({
      id: "token-id-1",
      userId: activeUser.id,
      tokenHash: "hashed-token-xyz",
      expiresAt: new Date(Date.now() + 1800000),
      usedAt: null,
      createdAt: new Date(),
    });
    vi.mocked(mockEmailPort.sendEmail).mockResolvedValue({
      messageId: "email-1",
      deliveredAt: new Date(),
    });

    const result = await useCase.execute({ email: activeUser.email });

    expect(result.message).toBe(
      "If your email is registered, you will receive password reset instructions shortly.",
    );

    // Advisory lock acquired for the user
    expect(
      mockPasswordResetTokenRepository.acquireUserIssuanceLock,
    ).toHaveBeenCalledWith(activeUser.id);

    // Prior active tokens invalidated
    expect(
      mockPasswordResetTokenRepository.invalidateActiveTokensForUser,
    ).toHaveBeenCalledWith(activeUser.id, expect.any(Date));

    // Token persisted with tokenHash (NEVER raw token)
    expect(mockPasswordResetTokenRepository.createToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: activeUser.id,
        tokenHash: "hashed-token-xyz",
        usedAt: null,
      }),
    );

    // Raw token never returned in result envelope
    expect(result).not.toHaveProperty("rawToken");
    expect(result).not.toHaveProperty("token");

    // Email dispatch occurred
    expect(mockEmailPort.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: activeUser.email,
        subject: expect.stringContaining("Atur Ulang Kata Sandi"),
        text: expect.stringContaining(
          "https://barberkece.id/reset-password?token=raw-reset-token-xyz",
        ),
        html: expect.stringContaining(
          "https://barberkece.id/reset-password?token=raw-reset-token-xyz",
        ),
      }),
    );
  });

  it("should strictly enforce 30-minute (1800s) token expiration", async () => {
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(activeUser);
    vi.mocked(mockTokenPort.generateToken).mockResolvedValue("raw-token");
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("hashed-token");
    vi.mocked(mockEmailPort.sendEmail).mockResolvedValue({
      messageId: "email-1",
      deliveredAt: new Date(),
    });

    const before = Date.now();
    await useCase.execute({ email: activeUser.email });
    const after = Date.now();

    const createdTokenCall = vi.mocked(
      mockPasswordResetTokenRepository.createToken,
    ).mock.calls[0][0];

    const diff =
      createdTokenCall.expiresAt.getTime() -
      createdTokenCall.createdAt.getTime();
    expect(diff).toBe(30 * 60 * 1000); // exactly 1800000 ms
    expect(createdTokenCall.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(createdTokenCall.createdAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("should send email strictly AFTER transaction commit has completed", async () => {
    const callOrder: string[] = [];

    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(activeUser);
    vi.mocked(mockTokenPort.generateToken).mockResolvedValue("raw-token");
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("hashed-token");

    vi.mocked(mockTransactionRunner.run).mockImplementation(async (work) => {
      callOrder.push("tx-start");
      const result = await work({
        userRepository: mockUserRepository,
        passwordResetTokenRepository: mockPasswordResetTokenRepository,
        sessionRepository: mockSessionRepository,
      });
      callOrder.push("tx-commit");
      return result;
    });

    vi.mocked(mockEmailPort.sendEmail).mockImplementation(async () => {
      callOrder.push("email-send");
      return { messageId: "1", deliveredAt: new Date() };
    });

    await useCase.execute({ email: activeUser.email });

    expect(callOrder).toEqual(["tx-start", "tx-commit", "email-send"]);
  });

  it("should not send email if the database transaction fails and rolls back", async () => {
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(activeUser);
    vi.mocked(mockTokenPort.generateToken).mockResolvedValue("raw-token");
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("hashed-token");

    vi.mocked(mockTransactionRunner.run).mockRejectedValue(
      new IdentityError("Database transaction failed"),
    );

    await expect(useCase.execute({ email: activeUser.email })).rejects.toThrow(
      "Database transaction failed",
    );

    expect(mockEmailPort.sendEmail).not.toHaveBeenCalled();
  });
});
