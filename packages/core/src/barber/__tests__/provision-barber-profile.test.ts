import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProvisionBarberProfileUseCase } from "../use-cases/provision-barber-profile.js";
import { BarberProfileRepository } from "../ports/barber-profile-repository.js";
import { BarberError } from "../errors.js";
import { BarberProfile } from "../models/barber-profile.js";
import { UserRepository } from "../../identity/ports/user-repository.js";
import { User } from "../../identity/models/user.js";

const makeBarberUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  email: "barber@example.com",
  role: "BARBER",
  status: "ACTIVE",
  emailVerifiedAt: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeProfile = (): BarberProfile => ({
  id: "profile-1",
  userId: "user-1",
  specialization: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("ProvisionBarberProfileUseCase", () => {
  const mockBarberRepo: BarberProfileRepository = {
    provisionProfile: vi.fn(),
    updateSpecialization: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
  };

  const mockUserRepo: UserRepository = {
    createUser: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    countByRole: vi.fn(),
    updatePassword: vi.fn(),
  };

  let useCase: ProvisionBarberProfileUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ProvisionBarberProfileUseCase(mockBarberRepo, mockUserRepo);
  });

  it("provisions a profile for a BARBER user", async () => {
    const user = makeBarberUser();
    const profile = makeProfile();
    vi.mocked(mockUserRepo.findById).mockResolvedValueOnce(user);
    vi.mocked(mockBarberRepo.provisionProfile).mockResolvedValueOnce(profile);

    const result = await useCase.execute({ userId: "user-1" });

    expect(mockUserRepo.findById).toHaveBeenCalledWith("user-1");
    expect(mockBarberRepo.provisionProfile).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
    expect(result).toEqual(profile);
  });

  it("provisions with specialization", async () => {
    const user = makeBarberUser();
    const profile = { ...makeProfile(), specialization: "Fade" };
    vi.mocked(mockUserRepo.findById).mockResolvedValueOnce(user);
    vi.mocked(mockBarberRepo.provisionProfile).mockResolvedValueOnce(profile);

    await useCase.execute({ userId: "user-1", specialization: "Fade" });

    expect(mockBarberRepo.provisionProfile).toHaveBeenCalledWith(
      expect.objectContaining({ specialization: "Fade" }),
    );
  });

  it("rejects when user does not exist", async () => {
    vi.mocked(mockUserRepo.findById).mockResolvedValueOnce(null);

    await expect(useCase.execute({ userId: "ghost" })).rejects.toThrowError(
      BarberError,
    );

    expect(mockBarberRepo.provisionProfile).not.toHaveBeenCalled();
  });

  it("rejects when user is not a BARBER (CUSTOMER)", async () => {
    vi.mocked(mockUserRepo.findById).mockResolvedValueOnce(
      makeBarberUser({ role: "CUSTOMER" }),
    );

    await expect(useCase.execute({ userId: "user-1" })).rejects.toThrowError(
      BarberError,
    );

    expect(mockBarberRepo.provisionProfile).not.toHaveBeenCalled();
  });

  it("rejects when user is not a BARBER (ADMIN)", async () => {
    vi.mocked(mockUserRepo.findById).mockResolvedValueOnce(
      makeBarberUser({ role: "ADMIN" }),
    );

    await expect(useCase.execute({ userId: "user-1" })).rejects.toThrowError(
      new BarberError("User user-1 does not have the BARBER role"),
    );
  });

  it("propagates repository errors (e.g. duplicate profile)", async () => {
    vi.mocked(mockUserRepo.findById).mockResolvedValueOnce(makeBarberUser());
    vi.mocked(mockBarberRepo.provisionProfile).mockRejectedValueOnce(
      new Error("duplicate key value violates unique constraint"),
    );

    await expect(useCase.execute({ userId: "user-1" })).rejects.toThrow();
  });
});
