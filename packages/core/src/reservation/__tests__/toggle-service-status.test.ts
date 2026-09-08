import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToggleServiceStatusUseCase } from "../use-cases/toggle-service-status.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { ServiceNotFoundError } from "../errors.js";
import { Service } from "../models/service.js";

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

describe("ToggleServiceStatusUseCase", () => {
  const mockRepo: ServiceRepository = {
    createService: vi.fn(),
    updateService: vi.fn(),
    updateServiceStatus: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
  };

  let useCase: ToggleServiceStatusUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ToggleServiceStatusUseCase(mockRepo);
  });

  it("deactivates an active service", async () => {
    const inactive = makeService({ isActive: false });
    vi.mocked(mockRepo.updateServiceStatus).mockResolvedValueOnce(inactive);

    const result = await useCase.execute("svc-1", false);

    expect(mockRepo.updateServiceStatus).toHaveBeenCalledWith("svc-1", false);
    expect(result.isActive).toBe(false);
  });

  it("activates an inactive service", async () => {
    const active = makeService({ isActive: true });
    vi.mocked(mockRepo.updateServiceStatus).mockResolvedValueOnce(active);

    const result = await useCase.execute("svc-1", true);

    expect(mockRepo.updateServiceStatus).toHaveBeenCalledWith("svc-1", true);
    expect(result.isActive).toBe(true);
  });

  it("throws ServiceNotFoundError when repo reports not found", async () => {
    vi.mocked(mockRepo.updateServiceStatus).mockRejectedValueOnce(
      new Error("Service not found: svc-999"),
    );
    await expect(useCase.execute("svc-999", false)).rejects.toThrowError(
      ServiceNotFoundError,
    );
  });
});
