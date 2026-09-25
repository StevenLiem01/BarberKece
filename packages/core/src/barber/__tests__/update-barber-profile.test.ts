import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateBarberProfileUseCase } from "../use-cases/update-barber-profile.js";
import { BarberProfileRepository } from "../ports/barber-profile-repository.js";
import { BarberProfileNotFoundError } from "../errors.js";
import { BarberProfile } from "../models/barber-profile.js";

const makeProfile = (
  overrides: Partial<BarberProfile> = {},
): BarberProfile => ({
  id: "profile-1",
  userId: "user-1",
  displayName: "Fajar",
  specialization: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("UpdateBarberProfileUseCase", () => {
  const mockRepo: BarberProfileRepository = {
    provisionProfile: vi.fn(),
    updateSpecialization: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
    lockProfiles: vi.fn(),
  };

  let useCase: UpdateBarberProfileUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new UpdateBarberProfileUseCase(mockRepo);
  });

  it("updates specialization", async () => {
    const updated = makeProfile({ specialization: "Fade" });
    vi.mocked(mockRepo.updateSpecialization).mockResolvedValueOnce(updated);

    const result = await useCase.execute("profile-1", {
      specialization: "Fade",
    });

    expect(mockRepo.updateSpecialization).toHaveBeenCalledWith(
      "profile-1",
      "Fade",
    );
    expect(result.specialization).toBe("Fade");
  });

  it("clears specialization when set to null", async () => {
    const updated = makeProfile({ specialization: null });
    vi.mocked(mockRepo.updateSpecialization).mockResolvedValueOnce(updated);

    await useCase.execute("profile-1", { specialization: null });

    expect(mockRepo.updateSpecialization).toHaveBeenCalledWith(
      "profile-1",
      null,
    );
  });

  it("does not clear specialization on empty update", async () => {
    const existing = makeProfile({ specialization: "Fade" });
    vi.mocked(mockRepo.findById).mockResolvedValueOnce(existing);

    const result = await useCase.execute("profile-1", {});

    expect(mockRepo.findById).toHaveBeenCalledWith("profile-1");
    expect(mockRepo.updateSpecialization).not.toHaveBeenCalled();
    expect(result.specialization).toBe("Fade");
  });

  it("throws BarberProfileNotFoundError on empty update when profile not found", async () => {
    vi.mocked(mockRepo.findById).mockResolvedValueOnce(null);

    await expect(useCase.execute("ghost", {})).rejects.toThrowError(
      BarberProfileNotFoundError,
    );
  });

  it("throws BarberProfileNotFoundError when repo reports not found", async () => {
    vi.mocked(mockRepo.updateSpecialization).mockRejectedValueOnce(
      new Error("Barber profile not found: profile-999"),
    );

    await expect(
      useCase.execute("profile-999", { specialization: "Skin Fade" }),
    ).rejects.toThrowError(BarberProfileNotFoundError);
  });
});
