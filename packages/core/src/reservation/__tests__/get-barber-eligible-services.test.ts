import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetBarberEligibleServicesUseCase } from "../use-cases/get-barber-eligible-services.js";
import { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";
import { BarberProfileNotFoundError } from "../../barber/errors.js";
import { BarberEligibilityRepository } from "../ports/barber-eligibility-repository.js";
import { BarberProfile } from "../../barber/models/barber-profile.js";
import { Service } from "../models/service.js";

const makeProfile = (): BarberProfile => ({
  id: "barber-1",
  userId: "user-1",
  specialization: "Fade",
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeService = (overrides: Partial<Service> = {}): Service => ({
  id: "svc-1",
  name: "Haircut",
  description: null,
  durationMinutes: 30,
  priceRupiah: 50000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("GetBarberEligibleServicesUseCase", () => {
  const mockBarberRepo: BarberProfileRepository = {
    provisionProfile: vi.fn(),
    updateSpecialization: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
    lockProfiles: vi.fn(),
  };

  const mockEligibilityRepo: BarberEligibilityRepository = {
    assignService: vi.fn(),
    removeService: vi.fn(),
    findServicesByBarberId: vi.fn(),
    isEligible: vi.fn(),
    findEligibleBarberProfileIds: vi.fn(),
  };

  let useCase: GetBarberEligibleServicesUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetBarberEligibleServicesUseCase(
      mockBarberRepo,
      mockEligibilityRepo,
    );
  });

  it("throws BarberProfileNotFoundError when barber profile does not exist", async () => {
    vi.mocked(mockBarberRepo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ barberProfileId: "ghost" }),
    ).rejects.toThrowError(BarberProfileNotFoundError);

    expect(mockEligibilityRepo.findServicesByBarberId).not.toHaveBeenCalled();
  });

  it("returns all eligible services when activeOnly is false or omitted", async () => {
    const barber = makeProfile();
    const activeSvc = makeService({ id: "svc-1", isActive: true });
    const inactiveSvc = makeService({ id: "svc-2", isActive: false });

    vi.mocked(mockBarberRepo.findById).mockResolvedValueOnce(barber);
    vi.mocked(mockEligibilityRepo.findServicesByBarberId).mockResolvedValueOnce(
      [activeSvc, inactiveSvc],
    );

    const result = await useCase.execute({ barberProfileId: "barber-1" });

    expect(mockEligibilityRepo.findServicesByBarberId).toHaveBeenCalledWith(
      "barber-1",
    );
    expect(result).toHaveLength(2);
    expect(result).toEqual([activeSvc, inactiveSvc]);
  });

  it("filters and returns only active eligible services when activeOnly is true", async () => {
    const barber = makeProfile();
    const activeSvc = makeService({ id: "svc-1", isActive: true });
    const inactiveSvc = makeService({ id: "svc-2", isActive: false });

    vi.mocked(mockBarberRepo.findById).mockResolvedValueOnce(barber);
    vi.mocked(mockEligibilityRepo.findServicesByBarberId).mockResolvedValueOnce(
      [activeSvc, inactiveSvc],
    );

    const result = await useCase.execute({
      barberProfileId: "barber-1",
      activeOnly: true,
    });

    expect(result).toHaveLength(1);
    expect(result).toEqual([activeSvc]);
  });
});
