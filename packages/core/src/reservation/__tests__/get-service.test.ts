import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetServiceUseCase } from "../use-cases/get-service.js";
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

  it("returns inactive service when activeOnly is false or omitted", async () => {
    const inactive = makeService({ isActive: false });
    vi.mocked(mockRepo.findById).mockResolvedValueOnce(inactive);

    const result = await useCase.execute("svc-1");
    expect(result).toEqual(inactive);

    vi.mocked(mockRepo.findById).mockResolvedValueOnce(inactive);
    const resultExplicit = await useCase.execute("svc-1", {
      activeOnly: false,
    });
    expect(resultExplicit).toEqual(inactive);
  });

  it("returns active service when activeOnly is true", async () => {
    const active = makeService({ isActive: true });
    vi.mocked(mockRepo.findById).mockResolvedValueOnce(active);

    const result = await useCase.execute("svc-1", { activeOnly: true });
    expect(result).toEqual(active);
  });

  it("throws ServiceNotFoundError when activeOnly is true and service is inactive", async () => {
    const inactive = makeService({ isActive: false });
    vi.mocked(mockRepo.findById).mockResolvedValueOnce(inactive);

    await expect(
      useCase.execute("svc-1", { activeOnly: true }),
    ).rejects.toThrowError(ServiceNotFoundError);
  });

  it("throws ServiceNotFoundError when not found", async () => {
    vi.mocked(mockRepo.findById).mockResolvedValueOnce(null);

    await expect(useCase.execute("missing")).rejects.toThrowError(
      ServiceNotFoundError,
    );
  });
});
