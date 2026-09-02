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
      email: "  TestUser@Example.com  ",
      passwordRaw: "password123",
    });

    expect(mockPasswordHashing.hashPassword).toHaveBeenCalledWith(
      "password123",
    );
    expect(mockUserRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "testuser@example.com",
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

  it("should reject missing email", async () => {
    await expect(
      useCase.execute({ email: "", passwordRaw: "password123" }),
    ).rejects.toThrowError(new IdentityError("Email is required"));
  });

  it("should reject missing password", async () => {
    await expect(
      useCase.execute({ email: "test@example.com", passwordRaw: "" }),
    ).rejects.toThrowError(new IdentityError("Password is required"));
  });

  it("should reject short password", async () => {
    await expect(
      useCase.execute({ email: "test@example.com", passwordRaw: "short" }),
    ).rejects.toThrowError(
      new IdentityError("Password must be at least 8 characters"),
    );
  });

  it("should map repository failure safely", async () => {
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValueOnce("hashed");
    vi.mocked(mockUserRepository.createUser).mockRejectedValueOnce(
      new IdentityError("Email is already registered"),
    );

    await expect(
      useCase.execute({
        email: "duplicate@example.com",
        passwordRaw: "password123",
      }),
    ).rejects.toThrowError(new IdentityError("Email is already registered"));
  });
});
