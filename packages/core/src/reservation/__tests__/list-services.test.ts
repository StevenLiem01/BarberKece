import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListServicesUseCase } from "../use-cases/list-services.js";
import { ServiceRepository } from "../ports/service-repository.js";
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

describe("ListServicesUseCase", () => {
  const mockRepo: ServiceRepository = {
    createService: vi.fn(),
    updateService: vi.fn(),
    updateServiceStatus: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
  };

  let useCase: ListServicesUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ListServicesUseCase(mockRepo);
  });

  it("defaults to active-only listing", async () => {
    const svcs = [makeService({ id: "svc-1" })];
    vi.mocked(mockRepo.findActive).mockResolvedValueOnce(svcs);

    const result = await useCase.execute();

    expect(mockRepo.findActive).toHaveBeenCalled();
    expect(mockRepo.findAll).not.toHaveBeenCalled();
    expect(result).toEqual(svcs);
  });

  it("uses findActive for 'active' filter", async () => {
    const svcs = [makeService()];
    vi.mocked(mockRepo.findActive).mockResolvedValueOnce(svcs);

    await useCase.execute("active");

    expect(mockRepo.findActive).toHaveBeenCalled();
    expect(mockRepo.findAll).not.toHaveBeenCalled();
  });

  it("uses findAll for 'all' filter (admin listing)", async () => {
    const active = makeService({ id: "a", isActive: true });
    const inactive = makeService({ id: "b", isActive: false });
    vi.mocked(mockRepo.findAll).mockResolvedValueOnce([active, inactive]);

    const result = await useCase.execute("all");

    expect(mockRepo.findAll).toHaveBeenCalled();
    expect(mockRepo.findActive).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no services exist", async () => {
    vi.mocked(mockRepo.findActive).mockResolvedValueOnce([]);

    const result = await useCase.execute("active");

    expect(result).toEqual([]);
  });
});
