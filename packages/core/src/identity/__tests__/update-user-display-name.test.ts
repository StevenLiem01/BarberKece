import { describe, it, expect, vi } from "vitest";
import { UpdateUserDisplayNameUseCase } from "../use-cases/update-user-display-name.js";
import { UserRepository } from "../ports/user-repository.js";
import { IdentityError } from "../errors.js";
import { User } from "../models/user.js";

describe("UpdateUserDisplayNameUseCase", () => {
  const baseUser: User = {
    id: "user-123",
    email: "barber@example.com",
    displayName: null,
    role: "BARBER",
    status: "ACTIVE",
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserRepository: UserRepository = {
    createUser: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    countByRole: vi.fn(),
    updatePassword: vi.fn(),
    updateDisplayName: vi.fn(),
  };

  const useCase = new UpdateUserDisplayNameUseCase(mockUserRepository);

  it("should update display name successfully", async () => {
    const updatedUser = { ...baseUser, displayName: "Rizal" };
    vi.mocked(mockUserRepository.updateDisplayName).mockResolvedValueOnce(
      updatedUser,
    );

    const result = await useCase.execute({
      userId: "user-123",
      displayName: "Rizal",
    });

    expect(mockUserRepository.updateDisplayName).toHaveBeenCalledWith(
      "user-123",
      "Rizal",
    );
    expect(result.displayName).toBe("Rizal");
  });

  it("should trim whitespace before updating", async () => {
    const updatedUser = { ...baseUser, displayName: "Rizal" };
    vi.mocked(mockUserRepository.updateDisplayName).mockResolvedValueOnce(
      updatedUser,
    );

    await useCase.execute({
      userId: "user-123",
      displayName: "  Rizal  ",
    });

    expect(mockUserRepository.updateDisplayName).toHaveBeenCalledWith(
      "user-123",
      "Rizal",
    );
  });

  it("should reject blank displayName", async () => {
    await expect(
      useCase.execute({ userId: "user-123", displayName: "" }),
    ).rejects.toThrowError(new IdentityError("Display name must not be blank"));
  });

  it("should reject whitespace-only displayName", async () => {
    await expect(
      useCase.execute({ userId: "user-123", displayName: "   " }),
    ).rejects.toThrowError(new IdentityError("Display name must not be blank"));
  });

  it("should reject displayName longer than 100 characters", async () => {
    const longName = "b".repeat(101);
    await expect(
      useCase.execute({ userId: "user-123", displayName: longName }),
    ).rejects.toThrowError(
      new IdentityError("Display name must not exceed 100 characters"),
    );
  });

  it("should propagate IdentityError when user not found", async () => {
    vi.mocked(mockUserRepository.updateDisplayName).mockRejectedValueOnce(
      new IdentityError("User not found for display name update"),
    );

    await expect(
      useCase.execute({ userId: "missing", displayName: "Rizal" }),
    ).rejects.toThrowError(
      new IdentityError("User not found for display name update"),
    );
  });
});
