import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetServiceUseCase } from "../use-cases/get-service.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { ServiceNotFoundError } from "../errors.js";
import { Service } from "../models/service.js";

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

describe("GetServiceUseCase", () => {
  const mockRepo: ServiceRepository = {
    createService: vi.fn(),
    updateService: vi.fn(),
    updateServiceStatus: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
  };

  let useCase: GetServiceUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetServiceUseCase(mockRepo);
  });

  it("returns a service when found", async () => {
    const svc = makeService();
    vi.mocked(mockRepo.findById).mockResolvedValueOnce(svc);

    const result = await useCase.execute("svc-1");

    expect(mockRepo.findById).toHaveBeenCalledWith("svc-1");
    expect(result).toEqual(svc);
  });

  it("throws ServiceNotFoundError when not found", async () => {
    vi.mocked(mockRepo.findById).mockResolvedValueOnce(null);

    await expect(useCase.execute("missing")).rejects.toThrowError(
      ServiceNotFoundError,
    );
  });
});
