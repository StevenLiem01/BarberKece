import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateServiceUseCase } from "../use-cases/update-service.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { ReservationError, ServiceNotFoundError } from "../errors.js";
import { Service } from "../models/service.js";

const makeService = (overrides: Partial<Service> = {}): Service => ({
  id: "svc-1",
  name: "Original",
  description: null,
  durationMinutes: 30,
  priceRupiah: 50000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("UpdateServiceUseCase", () => {
  const mockRepo: ServiceRepository = {
    createService: vi.fn(),
    updateService: vi.fn(),
    updateServiceStatus: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
  };

  let useCase: UpdateServiceUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new UpdateServiceUseCase(mockRepo);
  });

  it("updates name and duration", async () => {
    const updated = makeService({ name: "New Name", durationMinutes: 45 });
    vi.mocked(mockRepo.updateService).mockResolvedValueOnce(updated);

    const result = await useCase.execute("svc-1", {
      name: "New Name",
      durationMinutes: 45,
    });

    expect(mockRepo.updateService).toHaveBeenCalledWith(
      "svc-1",
      expect.objectContaining({ name: "New Name", durationMinutes: 45 }),
    );
    expect(result).toEqual(updated);
  });

  it("rejects empty name string", async () => {
    await expect(useCase.execute("svc-1", { name: "  " })).rejects.toThrowError(
      new ReservationError("Service name must not be empty"),
    );
    expect(mockRepo.updateService).not.toHaveBeenCalled();
  });

  it("rejects zero duration", async () => {
    await expect(
      useCase.execute("svc-1", { durationMinutes: 0 }),
    ).rejects.toThrowError(
      new ReservationError("Duration must be a positive integer"),
    );
  });

  it("rejects negative duration", async () => {
    await expect(
      useCase.execute("svc-1", { durationMinutes: -10 }),
    ).rejects.toThrowError(
      new ReservationError("Duration must be a positive integer"),
    );
  });

  it("rejects decimal duration", async () => {
    await expect(
      useCase.execute("svc-1", { durationMinutes: 45.5 }),
    ).rejects.toThrowError(
      new ReservationError("Duration must be a positive integer"),
    );
  });

  it("rejects NaN duration", async () => {
    await expect(
      useCase.execute("svc-1", { durationMinutes: NaN }),
    ).rejects.toThrowError(
      new ReservationError("Duration must be a positive integer"),
    );
  });

  it("rejects Infinity duration", async () => {
    await expect(
      useCase.execute("svc-1", { durationMinutes: Infinity }),
    ).rejects.toThrowError(
      new ReservationError("Duration must be a positive integer"),
    );
  });

  it("rejects negative price", async () => {
    await expect(
      useCase.execute("svc-1", { priceRupiah: -100 }),
    ).rejects.toThrowError(
      new ReservationError("Price must be a non-negative integer"),
    );
  });

  it("rejects decimal price", async () => {
    await expect(
      useCase.execute("svc-1", { priceRupiah: 1000.5 }),
    ).rejects.toThrowError(
      new ReservationError("Price must be a non-negative integer"),
    );
  });

  it("rejects NaN price", async () => {
    await expect(
      useCase.execute("svc-1", { priceRupiah: NaN }),
    ).rejects.toThrowError(
      new ReservationError("Price must be a non-negative integer"),
    );
  });

  it("rejects Infinity price", async () => {
    await expect(
      useCase.execute("svc-1", { priceRupiah: Infinity }),
    ).rejects.toThrowError(
      new ReservationError("Price must be a non-negative integer"),
    );
  });

  it("allows zero price update", async () => {
    const updated = makeService({ priceRupiah: 0 });
    vi.mocked(mockRepo.updateService).mockResolvedValueOnce(updated);

    const result = await useCase.execute("svc-1", { priceRupiah: 0 });

    expect(mockRepo.updateService).toHaveBeenCalledWith(
      "svc-1",
      expect.objectContaining({ priceRupiah: 0 }),
    );
    expect(result.priceRupiah).toBe(0);
  });

  it("throws ServiceNotFoundError when repo reports not found", async () => {
    vi.mocked(mockRepo.updateService).mockRejectedValueOnce(
      new Error("Service not found: svc-999"),
    );
    await expect(
      useCase.execute("svc-999", { name: "X" }),
    ).rejects.toThrowError(ServiceNotFoundError);
  });
});
