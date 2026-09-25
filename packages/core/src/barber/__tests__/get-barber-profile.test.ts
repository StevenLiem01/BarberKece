import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetBarberProfileUseCase } from "../use-cases/get-barber-profile.js";
import { BarberProfileRepository } from "../ports/barber-profile-repository.js";
import { BarberProfileNotFoundError } from "../errors.js";
import { BarberProfile } from "../models/barber-profile.js";

const makeProfile = (): BarberProfile => ({
  id: "profile-1",
  userId: "user-1",
  displayName: "Ahmad Barber",
  specialization: "Fade",
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("GetBarberProfileUseCase", () => {
  const mockRepo: BarberProfileRepository = {
    provisionProfile: vi.fn(),
    updateSpecialization: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
    lockProfiles: vi.fn(),
  };

  let useCase: GetBarberProfileUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetBarberProfileUseCase(mockRepo);
  });

  it("returns the profile when found", async () => {
    const profile = makeProfile();
    vi.mocked(mockRepo.findById).mockResolvedValueOnce(profile);

    const result = await useCase.execute("profile-1");

    expect(mockRepo.findById).toHaveBeenCalledWith("profile-1");
    expect(result).toEqual(profile);
  });

  it("throws BarberProfileNotFoundError when not found", async () => {
    vi.mocked(mockRepo.findById).mockResolvedValueOnce(null);

    await expect(useCase.execute("missing")).rejects.toThrowError(
      BarberProfileNotFoundError,
    );
  });
});
