import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateServiceUseCase } from "../use-cases/create-service.js";
import { ServiceRepository } from "../ports/service-repository.js";
import { ReservationError } from "../errors.js";
import { Service } from "../models/service.js";

const makeService = (overrides: Partial<Service> = {}): Service => ({
  id: "svc-id",
  name: "Haircut",
  description: null,
  durationMinutes: 30,
  priceRupiah: 50000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("CreateServiceUseCase", () => {
  const mockRepo: ServiceRepository = {
    createService: vi.fn(),
    updateService: vi.fn(),
    updateServiceStatus: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
  };

  let useCase: CreateServiceUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CreateServiceUseCase(mockRepo);
  });

  it("creates a service with valid input", async () => {
    const svc = makeService();
    vi.mocked(mockRepo.createService).mockResolvedValueOnce(svc);

    const result = await useCase.execute({
      name: "Haircut",
      durationMinutes: 30,
      priceRupiah: 50000,
    });

    expect(mockRepo.createService).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Haircut",
        durationMinutes: 30,
        priceRupiah: 50000,
        isActive: true,
      }),
    );
    expect(result).toEqual(svc);
  });

  it("trims whitespace from name", async () => {
    const svc = makeService({ name: "Fade" });
    vi.mocked(mockRepo.createService).mockResolvedValueOnce(svc);

    await useCase.execute({
      name: "  Fade  ",
      durationMinutes: 30,
      priceRupiah: 0,
    });

    expect(mockRepo.createService).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Fade" }),
    );
  });

  it("rejects empty name", async () => {
    await expect(
      useCase.execute({ name: "", durationMinutes: 30, priceRupiah: 50000 }),
    ).rejects.toThrowError(new ReservationError("Service name is required"));
    expect(mockRepo.createService).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only name", async () => {
    await expect(
      useCase.execute({ name: "   ", durationMinutes: 30, priceRupiah: 50000 }),
    ).rejects.toThrowError(new ReservationError("Service name is required"));
  });

  it("rejects zero duration", async () => {
    await expect(
      useCase.execute({ name: "Cut", durationMinutes: 0, priceRupiah: 50000 }),
    ).rejects.toThrowError(
      new ReservationError("Duration must be a positive integer"),
    );
  });

  it("rejects negative duration", async () => {
    await expect(
      useCase.execute({ name: "Cut", durationMinutes: -5, priceRupiah: 50000 }),
    ).rejects.toThrowError(
      new ReservationError("Duration must be a positive integer"),
    );
  });

  it("rejects decimal duration", async () => {
    await expect(
      useCase.execute({
        name: "Cut",
        durationMinutes: 30.5,
        priceRupiah: 50000,
      }),
    ).rejects.toThrowError(
      new ReservationError("Duration must be a positive integer"),
    );
  });

  it("rejects NaN duration", async () => {
    await expect(
      useCase.execute({
        name: "Cut",
        durationMinutes: NaN,
        priceRupiah: 50000,
      }),
    ).rejects.toThrowError(
      new ReservationError("Duration must be a positive integer"),
    );
  });

  it("rejects Infinity duration", async () => {
    await expect(
      useCase.execute({
        name: "Cut",
        durationMinutes: Infinity,
        priceRupiah: 50000,
      }),
    ).rejects.toThrowError(
      new ReservationError("Duration must be a positive integer"),
    );
  });

  it("rejects negative price", async () => {
    await expect(
      useCase.execute({ name: "Cut", durationMinutes: 30, priceRupiah: -1 }),
    ).rejects.toThrowError(
      new ReservationError("Price must be a non-negative integer"),
    );
  });

  it("rejects decimal price", async () => {
    await expect(
      useCase.execute({
        name: "Cut",
        durationMinutes: 30,
        priceRupiah: 50000.75,
      }),
    ).rejects.toThrowError(
      new ReservationError("Price must be a non-negative integer"),
    );
  });

  it("rejects NaN price", async () => {
    await expect(
      useCase.execute({
        name: "Cut",
        durationMinutes: 30,
        priceRupiah: NaN,
      }),
    ).rejects.toThrowError(
      new ReservationError("Price must be a non-negative integer"),
    );
  });

  it("rejects Infinity price", async () => {
    await expect(
      useCase.execute({
        name: "Cut",
        durationMinutes: 30,
        priceRupiah: Infinity,
      }),
    ).rejects.toThrowError(
      new ReservationError("Price must be a non-negative integer"),
    );
  });

  it("allows zero price", async () => {
    const svc = makeService({ priceRupiah: 0 });
    vi.mocked(mockRepo.createService).mockResolvedValueOnce(svc);

    await expect(
      useCase.execute({
        name: "Free Cut",
        durationMinutes: 15,
        priceRupiah: 0,
      }),
    ).resolves.toEqual(svc);
  });
});
