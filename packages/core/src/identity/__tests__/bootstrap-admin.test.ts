import { describe, it, expect, vi, beforeEach } from "vitest";
import { BootstrapAdminUseCase } from "../use-cases/bootstrap-admin.js";
import { UserRepository } from "../ports/user-repository.js";
import { PasswordHashingPort } from "../ports/password-hashing-port.js";
import { IdentityError } from "../errors.js";
import { User } from "../models/user.js";

describe("BootstrapAdminUseCase", () => {
  const mockUserRepository: UserRepository = {
    createUser: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    countByRole: vi.fn(),
  };

  const mockPasswordHashing: PasswordHashingPort = {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
  };

  let useCase: BootstrapAdminUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new BootstrapAdminUseCase(
      mockUserRepository,
      mockPasswordHashing,
    );
  });

  const defaultAdminUser: User = {
    id: "admin-uuidv7",
    email: "admin@barberkece.com",
    role: "ADMIN",
    status: "ACTIVE",
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("successfully bootstraps the first ADMIN and normalizes email", async () => {
    vi.mocked(mockUserRepository.countByRole).mockResolvedValueOnce(0);
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValueOnce(null);
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValueOnce(
      "hashed-argon2-password",
    );
    vi.mocked(mockUserRepository.createUser).mockResolvedValueOnce(
      defaultAdminUser,
    );

    const result = await useCase.execute({
      email: "  Admin@BarberKece.com  ",
      passwordRaw: "adminpassword123",
    });

    expect(mockUserRepository.countByRole).toHaveBeenCalledWith("ADMIN");
    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
      "admin@barberkece.com",
    );
    expect(mockPasswordHashing.hashPassword).toHaveBeenCalledWith(
      "adminpassword123",
    );
    expect(mockUserRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "admin@barberkece.com",
        passwordHash: "hashed-argon2-password",
        role: "ADMIN",
        status: "ACTIVE",
      }),
    );
    expect(result).toEqual(defaultAdminUser);
    expect(
      (result as unknown as Record<string, unknown>).passwordHash,
    ).toBeUndefined();
  });

  it("refuses to bootstrap if an ADMIN already exists (strictly first-admin-only policy)", async () => {
    vi.mocked(mockUserRepository.countByRole).mockResolvedValueOnce(1);

    await expect(
      useCase.execute({
        email: "newadmin@barberkece.com",
        passwordRaw: "adminpassword123",
      }),
    ).rejects.toThrowError(
      new IdentityError(
        "An ADMIN account already exists. Additional admins must be provisioned through the authorized admin flow.",
      ),
    );

    expect(mockPasswordHashing.hashPassword).not.toHaveBeenCalled();
    expect(mockUserRepository.createUser).not.toHaveBeenCalled();
  });

  it("rejects duplicate email if already registered as another role", async () => {
    vi.mocked(mockUserRepository.countByRole).mockResolvedValueOnce(0);
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValueOnce({
      id: "customer-123",
      email: "existing@example.com",
      passwordHash: "some-hash",
      role: "CUSTOMER",
      status: "ACTIVE",
      emailVerifiedAt: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      useCase.execute({
        email: "existing@example.com",
        passwordRaw: "adminpassword123",
      }),
    ).rejects.toThrowError(new IdentityError("Email is already registered"));

    expect(mockPasswordHashing.hashPassword).not.toHaveBeenCalled();
    expect(mockUserRepository.createUser).not.toHaveBeenCalled();
  });

  it("rejects missing or empty email", async () => {
    await expect(
      useCase.execute({
        email: "",
        passwordRaw: "adminpassword123",
      }),
    ).rejects.toThrowError(new IdentityError("Email is required"));
  });

  it("rejects missing password", async () => {
    await expect(
      useCase.execute({
        email: "admin@barberkece.com",
        passwordRaw: "",
      }),
    ).rejects.toThrowError(new IdentityError("Password is required"));
  });

  it("rejects short password (< 8 chars)", async () => {
    await expect(
      useCase.execute({
        email: "admin@barberkece.com",
        passwordRaw: "short",
      }),
    ).rejects.toThrowError(
      new IdentityError("Password must be at least 8 characters"),
    );
  });

  it("safely propagates repository errors without leaking sensitive data", async () => {
    vi.mocked(mockUserRepository.countByRole).mockResolvedValueOnce(0);
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValueOnce(null);
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValueOnce(
      "hashed-argon2-password",
    );
    vi.mocked(mockUserRepository.createUser).mockRejectedValueOnce(
      new IdentityError("Database error during user creation"),
    );

    await expect(
      useCase.execute({
        email: "admin@barberkece.com",
        passwordRaw: "adminpassword123",
      }),
    ).rejects.toThrowError(
      new IdentityError("Database error during user creation"),
    );
  });
});
