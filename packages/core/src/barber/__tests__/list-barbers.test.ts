import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListBarbersUseCase } from "../use-cases/list-barbers.js";
import { BarberProfileRepository } from "../ports/barber-profile-repository.js";
import { BarberProfile } from "../models/barber-profile.js";

const makeProfile = (id: string): BarberProfile => ({
  id,
  userId: `user-${id}`,
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
  };

  let useCase: ListBarbersUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ListBarbersUseCase(mockRepo);
  });

  it("returns all configured barber profiles", async () => {
    const profiles = [makeProfile("p1"), makeProfile("p2")];
    vi.mocked(mockRepo.findAll).mockResolvedValueOnce(profiles);

    const result = await useCase.execute();

    expect(mockRepo.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no barbers are configured", async () => {
    vi.mocked(mockRepo.findAll).mockResolvedValueOnce([]);

    const result = await useCase.execute();

    expect(result).toEqual([]);
  });
});
