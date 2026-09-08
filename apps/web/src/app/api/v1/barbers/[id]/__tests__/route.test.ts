import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import { BarberProfileNotFoundError } from "@barberkece/core/barber";

const { mockGetExecute } = vi.hoisted(() => ({
  mockGetExecute: vi.fn(),
}));

vi.mock("@barberkece/core/barber", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/barber")>();
  return {
    ...actual,
    GetBarberProfileUseCase: class {
      execute = mockGetExecute;
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

describe("Public Barber Detail Route: /api/v1/barbers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 if barber profile not found", async () => {
    mockGetExecute.mockRejectedValueOnce(
      new BarberProfileNotFoundError("barber-unknown"),
    );

    const req = new NextRequest(
      new URL("/api/v1/barbers/barber-unknown", "http://localhost:3000"),
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "barber-unknown" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });

  it("should return 200 with PublicBarberDto omitting userId", async () => {
    const now = new Date();
    mockGetExecute.mockResolvedValueOnce({
      id: "barber-1",
      userId: "internal-user-id-5678",
      specialization: "Colorist",
      createdAt: now,
      updatedAt: now,
    });

    const req = new NextRequest(
      new URL("/api/v1/barbers/barber-1", "http://localhost:3000"),
    );
    const res = await GET(req, { params: Promise.resolve({ id: "barber-1" }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({
      id: "barber-1",
      specialization: "Colorist",
    });
    // Critical: internal userId must never leak
    expect(json.data.userId).toBeUndefined();
  });
});
