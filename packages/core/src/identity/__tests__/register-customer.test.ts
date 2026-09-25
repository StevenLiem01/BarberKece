import { describe, it, expect, vi } from "vitest";
import { RegisterCustomerUseCase } from "../use-cases/register-customer.js";
import { UserRepository } from "../ports/user-repository.js";
import { PasswordHashingPort } from "../ports/password-hashing-port.js";
import { IdentityError } from "../errors.js";
import { User } from "../models/user.js";

describe("RegisterCustomerUseCase", () => {
  const mockUserRepository: UserRepository = {
    createUser: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    countByRole: vi.fn(),
    updatePassword: vi.fn(),
    updateDisplayName: vi.fn(),
  };

  const mockPasswordHashing: PasswordHashingPort = {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
  };

  const useCase = new RegisterCustomerUseCase(
    mockUserRepository,
    mockPasswordHashing,
  );

  const defaultUser: User = {
    id: "uuidv7-id",
    email: "test@example.com",
    displayName: "Ahmad Rizki",
    role: "CUSTOMER",
    status: "ACTIVE",
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should successfully register a customer and normalize email", async () => {
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValueOnce(
      "hashed-password",
    );
    vi.mocked(mockUserRepository.createUser).mockResolvedValueOnce(defaultUser);

    const result = await useCase.execute({
      displayName: "Ahmad Rizki",
      email: "  TestUser@Example.com  ",
      passwordRaw: "password123",
    });

    expect(mockPasswordHashing.hashPassword).toHaveBeenCalledWith(
      "password123",
    );
    expect(mockUserRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "testuser@example.com",
        displayName: "Ahmad Rizki",
        passwordHash: "hashed-password",
        role: "CUSTOMER",
        status: "ACTIVE",
      }),
    );
    // Should not return passwordHash
    expect(result).toEqual(defaultUser);
    expect(
      (result as unknown as Record<string, unknown>).passwordHash,
    ).toBeUndefined();
  });

  it("should trim whitespace from displayName", async () => {
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValueOnce("hash");
    vi.mocked(mockUserRepository.createUser).mockResolvedValueOnce(defaultUser);

    await useCase.execute({
      displayName: "  Ahmad Rizki  ",
      email: "user@example.com",
      passwordRaw: "password123",
    });

    expect(mockUserRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Ahmad Rizki" }),
    );
  });

  it("should preserve international characters in displayName", async () => {
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValueOnce("hash");
    const intlUser = { ...defaultUser, displayName: "Bộ Tư Pháp" };
    vi.mocked(mockUserRepository.createUser).mockResolvedValueOnce(intlUser);

    const result = await useCase.execute({
      displayName: "Bộ Tư Pháp",
      email: "intl@example.com",
      passwordRaw: "password123",
    });

    expect(mockUserRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Bộ Tư Pháp" }),
    );
    expect(result.displayName).toBe("Bộ Tư Pháp");
  });

  it("should reject missing email", async () => {
    await expect(
      useCase.execute({
        displayName: "Ahmad",
        email: "",
        passwordRaw: "password123",
      }),
    ).rejects.toThrowError(new IdentityError("Email is required"));
  });

  it("should reject missing password", async () => {
    await expect(
      useCase.execute({
        displayName: "Ahmad",
        email: "test@example.com",
        passwordRaw: "",
      }),
    ).rejects.toThrowError(new IdentityError("Password is required"));
  });

  it("should reject short password", async () => {
    await expect(
      useCase.execute({
        displayName: "Ahmad",
        email: "test@example.com",
        passwordRaw: "short",
      }),
    ).rejects.toThrowError(
      new IdentityError("Password must be at least 8 characters"),
    );
  });

  it("should reject missing displayName", async () => {
    await expect(
      useCase.execute({
        displayName: "",
        email: "test@example.com",
        passwordRaw: "password123",
      }),
    ).rejects.toThrowError(new IdentityError("Display name is required"));
  });

  it("should reject whitespace-only displayName", async () => {
    await expect(
      useCase.execute({
        displayName: "   ",
        email: "test@example.com",
        passwordRaw: "password123",
      }),
    ).rejects.toThrowError(new IdentityError("Display name must not be blank"));
  });

  it("should reject overlong displayName (>100 chars)", async () => {
    const longName = "a".repeat(101);
    await expect(
      useCase.execute({
        displayName: longName,
        email: "test@example.com",
        passwordRaw: "password123",
      }),
    ).rejects.toThrowError(
      new IdentityError("Display name must not exceed 100 characters"),
    );
  });

  it("should accept displayName of exactly 100 characters", async () => {
    const maxName = "a".repeat(100);
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValueOnce("hash");
    vi.mocked(mockUserRepository.createUser).mockResolvedValueOnce({
      ...defaultUser,
      displayName: maxName,
    });

    await expect(
      useCase.execute({
        displayName: maxName,
        email: "max@example.com",
        passwordRaw: "password123",
      }),
    ).resolves.not.toThrow();
  });

  it("should map repository failure safely", async () => {
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValueOnce("hashed");
    vi.mocked(mockUserRepository.createUser).mockRejectedValueOnce(
      new IdentityError("Email is already registered"),
    );

    await expect(
      useCase.execute({
        displayName: "Ahmad",
        email: "duplicate@example.com",
        passwordRaw: "password123",
      }),
    ).rejects.toThrowError(new IdentityError("Email is already registered"));
  });

  it("should ensure customer self-registration leaves emailVerifiedAt unverified (null)", async () => {
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValueOnce("hash");
    vi.mocked(mockUserRepository.createUser).mockResolvedValueOnce(defaultUser);

    const user = await useCase.execute({
      displayName: "Unverified Customer",
      email: "unverified@example.com",
      passwordRaw: "password123",
    });

    const createCall = vi.mocked(mockUserRepository.createUser).mock.calls.at(-1)?.[0];
    expect(createCall?.emailVerifiedAt).toBeUndefined();
    expect(user.emailVerifiedAt).toBeNull();
  });
});
