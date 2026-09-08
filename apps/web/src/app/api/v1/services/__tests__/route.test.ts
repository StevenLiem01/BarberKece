import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

const { mockListExecute } = vi.hoisted(() => ({
  mockListExecute: vi.fn(),
}));

vi.mock("@barberkece/core/reservation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/reservation")>();
  return {
    ...actual,
    ListServicesUseCase: class {
      execute = mockListExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresServiceRepository: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDatabaseClient: vi.fn(() => ({ db: {} })),
}));

vi.mock("@barberkece/infrastructure/logging", () => ({
  generateRequestId: vi.fn(() => "test-req-id"),
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Public Services Route: /api/v1/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with active services only (PublicServiceDto)", async () => {
    const now = new Date();
    mockListExecute.mockResolvedValueOnce([
      {
        id: "srv-1",
        name: "Classic Cut",
        durationMinutes: 30,
        priceRupiah: 50000,
        description: "Standard haircut",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([
      {
        id: "srv-1",
        name: "Classic Cut",
        durationMinutes: 30,
        priceRupiah: 50000,
        description: "Standard haircut",
      },
    ]);
    expect(mockListExecute).toHaveBeenCalledWith("active");
    // Assert sensitive fields are NOT in the public response
    expect(json.data[0].isActive).toBeUndefined();
    expect(json.data[0].createdAt).toBeUndefined();
    expect(json.data[0].updatedAt).toBeUndefined();
  });
});
