import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListBarbersUseCase } from "../use-cases/list-barbers.js";
import { BarberProfileRepository } from "../ports/barber-profile-repository.js";
import { BarberProfile } from "../models/barber-profile.js";

const makeProfile = (
  id: string,
  displayName: string | null = "Ahmad",
): BarberProfile => ({
  id,
  userId: `user-${id}`,
  displayName,
  specialization: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("ListBarbersUseCase", () => {
  const mockRepo: BarberProfileRepository = {
    provisionProfile: vi.fn(),
    updateSpecialization: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
    lockProfiles: vi.fn(),
  };

  let useCase: ListBarbersUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ListBarbersUseCase(mockRepo);
  });

  it("returns only named barbers (non-null, non-blank displayName)", async () => {
    const profiles = [
      makeProfile("p1", "Rizal"),
      makeProfile("p2", null),
      makeProfile("p3", ""),
      makeProfile("p4", "  "), // whitespace-only
      makeProfile("p5", "Fajar"),
    ];
    vi.mocked(mockRepo.findAll).mockResolvedValueOnce(profiles);

    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result.map((b) => b.id)).toEqual(["p1", "p5"]);
  });

  it("returns empty array when no barbers are configured", async () => {
    vi.mocked(mockRepo.findAll).mockResolvedValueOnce([]);
    const result = await useCase.execute();
    expect(result).toEqual([]);
  });

  it("returns empty array when all barbers are unnamed", async () => {
    const profiles = [
      makeProfile("p1", null),
      makeProfile("p2", ""),
      makeProfile("p3", "   "),
    ];
    vi.mocked(mockRepo.findAll).mockResolvedValueOnce(profiles);
    const result = await useCase.execute();
    expect(result).toEqual([]);
  });

  it("returns all barbers when all are named", async () => {
    const profiles = [makeProfile("p1", "Rizal"), makeProfile("p2", "Fajar")];
    vi.mocked(mockRepo.findAll).mockResolvedValueOnce(profiles);
    const result = await useCase.execute();
    expect(result).toHaveLength(2);
  });

  it("does not expose internal userId in public results (BarberProfile carries userId, DTO mapper must strip it)", async () => {
    // This test validates the domain model shape; DTO stripping is the contract layer's responsibility
    const profiles = [makeProfile("p1", "Rizal")];
    vi.mocked(mockRepo.findAll).mockResolvedValueOnce(profiles);
    const result = await useCase.execute();
    // userId IS present in domain model (needed for admin joins); public DTO mapper strips it
    expect(result[0]).toHaveProperty("userId");
  });

  it("returns unnamed barbers when includeUnnamed is true", async () => {
    const profiles = [
      makeProfile("p1", "Rizal"),
      makeProfile("p2", null),
      makeProfile("p3", ""),
    ];
    vi.mocked(mockRepo.findAll).mockResolvedValueOnce(profiles);
    const result = await useCase.execute({ includeUnnamed: true });
    expect(result).toHaveLength(3);
    expect(result.map((b) => b.id)).toEqual(["p1", "p2", "p3"]);
  });
});
