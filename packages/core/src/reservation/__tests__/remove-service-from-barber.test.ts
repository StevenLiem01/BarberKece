import { describe, it, expect, vi, beforeEach } from "vitest";
import { RemoveServiceFromBarberUseCase } from "../use-cases/remove-service-from-barber.js";
import { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";
import { BarberProfileNotFoundError } from "../../barber/errors.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { ServiceNotFoundError } from "../errors.js";
import { BarberEligibilityRepository } from "../ports/barber-eligibility-repository.js";
import { BarberProfile } from "../../barber/models/barber-profile.js";
import { Service } from "../models/service.js";

const makeProfile = (): BarberProfile => ({
  id: "profile-1",
  userId: "user-1",
  specialization: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeService = (): Service => ({
  id: "svc-1",
  name: "Haircut",
  description: null,
  durationMinutes: 30,
  priceRupiah: 50000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("RemoveServiceFromBarberUseCase", () => {
  const mockBarberRepo: BarberProfileRepository = {
    provisionProfile: vi.fn(),
    updateSpecialization: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
  };

  const mockServiceRepo: ServiceRepository = {
    createService: vi.fn(),
    updateService: vi.fn(),
    updateServiceStatus: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
  };

  const mockEligibilityRepo: BarberEligibilityRepository = {
    assignService: vi.fn(),
    removeService: vi.fn(),
    findServicesByBarberId: vi.fn(),
  };

  let useCase: RemoveServiceFromBarberUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new RemoveServiceFromBarberUseCase(
      mockBarberRepo,
      mockServiceRepo,
      mockEligibilityRepo,
    );
  });

  it("removes a service from a barber when both exist", async () => {
    vi.mocked(mockBarberRepo.findById).mockResolvedValueOnce(makeProfile());
    vi.mocked(mockServiceRepo.findById).mockResolvedValueOnce(makeService());
    vi.mocked(mockEligibilityRepo.removeService).mockResolvedValueOnce(
      undefined,
    );

    await useCase.execute({ barberProfileId: "profile-1", serviceId: "svc-1" });

    expect(mockEligibilityRepo.removeService).toHaveBeenCalledWith(
      "profile-1",
      "svc-1",
    );
  });

  it("throws BarberProfileNotFoundError when barber does not exist", async () => {
    vi.mocked(mockBarberRepo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ barberProfileId: "ghost", serviceId: "svc-1" }),
    ).rejects.toThrowError(BarberProfileNotFoundError);

    expect(mockEligibilityRepo.removeService).not.toHaveBeenCalled();
  });

  it("throws ServiceNotFoundError when service does not exist", async () => {
    vi.mocked(mockBarberRepo.findById).mockResolvedValueOnce(makeProfile());
    vi.mocked(mockServiceRepo.findById).mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ barberProfileId: "profile-1", serviceId: "ghost" }),
    ).rejects.toThrowError(ServiceNotFoundError);

    expect(mockEligibilityRepo.removeService).not.toHaveBeenCalled();
  });
});
