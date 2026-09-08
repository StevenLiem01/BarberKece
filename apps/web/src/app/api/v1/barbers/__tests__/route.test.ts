import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

const { mockListExecute } = vi.hoisted(() => ({
  mockListExecute: vi.fn(),
}));

vi.mock("@barberkece/core/barber", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/barber")>();
  return {
    ...actual,
    ListBarbersUseCase: class {
      execute = mockListExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresBarberProfileRepository: vi.fn(),
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

describe("Public Barbers Route: /api/v1/barbers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 with PublicBarberDto[] omitting userId", async () => {
    const now = new Date();
    mockListExecute.mockResolvedValueOnce([
      {
        id: "barber-1",
        userId: "internal-user-id-1234",
        specialization: "Fade Expert",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([
      {
        id: "barber-1",
        specialization: "Fade Expert",
      },
    ]);
    // Critical: userId and timestamps must not leak to public
    expect(json.data[0].userId).toBeUndefined();
    expect(json.data[0].createdAt).toBeUndefined();
    expect(json.data[0].updatedAt).toBeUndefined();
  });
});
