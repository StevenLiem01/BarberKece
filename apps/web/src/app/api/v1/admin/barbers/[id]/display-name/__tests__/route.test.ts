import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";

const { mockUpdateDisplayNameExecute, mockGetBarberProfileExecute } = vi.hoisted(() => ({
  mockUpdateDisplayNameExecute: vi.fn(),
  mockGetBarberProfileExecute: vi.fn(),
}));

vi.mock("@barberkece/core/identity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@barberkece/core/identity")>();
  return {
    ...actual,
    UpdateUserDisplayNameUseCase: class {
      execute = mockUpdateDisplayNameExecute;
    },
  };
});

vi.mock("@barberkece/core/barber", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@barberkece/core/barber")>();
  return {
    ...actual,
    GetBarberProfileUseCase: class {
      execute = mockGetBarberProfileExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresBarberProfileRepository: vi.fn(),
  PostgresUserRepository: vi.fn(),
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

const mockAuthenticateAdminApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  authenticateAdminApi: mockAuthenticateAdminApi,
}));

function createJsonRequest(
  url: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
) {
  const reqHeaders = new Headers({
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "content-type": "application/json",
    ...headers,
  });

  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("PATCH /api/v1/admin/barbers/[id]/display-name", () => {
  const barberId = "barber-uuid-1";
  const userId = "user-uuid-1";
  const params = Promise.resolve({ id: barberId });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateAdminApi.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    });
  });

  it("should return 403 on CSRF origin mismatch", async () => {
    const req = createJsonRequest(
      `/api/v1/admin/barbers/${barberId}/display-name`,
      "PATCH",
      { displayName: "Ahmad" },
      { origin: "http://malicious.com" },
    );

    const res = await PATCH(req, { params });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("should enforce admin authentication", async () => {
    mockAuthenticateAdminApi.mockResolvedValueOnce({
      response: new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED" } }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    });

    const req = createJsonRequest(
      `/api/v1/admin/barbers/${barberId}/display-name`,
      "PATCH",
      { displayName: "Ahmad" },
    );

    const res = await PATCH(req, { params });
    expect(res.status).toBe(401);
  });

  it("should return 400 on malformed JSON body", async () => {
    const req = new NextRequest(
      new URL(`/api/v1/admin/barbers/${barberId}/display-name`, "http://localhost:3000"),
      {
        method: "PATCH",
        headers: new Headers({
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "content-type": "application/json",
        }),
        body: "invalid-json{",
      },
    );

    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_JSON");
  });

  it("should return 400 on empty or whitespace-only displayName", async () => {
    const req = createJsonRequest(
      `/api/v1/admin/barbers/${barberId}/display-name`,
      "PATCH",
      { displayName: "   " },
    );

    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 on displayName exceeding 100 characters", async () => {
    const req = createJsonRequest(
      `/api/v1/admin/barbers/${barberId}/display-name`,
      "PATCH",
      { displayName: "A".repeat(101) },
    );

    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 404 when barber profile is not found", async () => {
    mockGetBarberProfileExecute.mockRejectedValueOnce(
      new Error(`Barber profile with ID ${barberId} not found`),
    );

    const req = createJsonRequest(
      `/api/v1/admin/barbers/${barberId}/display-name`,
      "PATCH",
      { displayName: "Ahmad Barber" },
    );

    const res = await PATCH(req, { params });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("BARBER_PROFILE_NOT_FOUND");
  });

  it("should update display name and return updated AdminBarberDto on success", async () => {
    const now = new Date();
    // First call resolves the profile to obtain userId
    mockGetBarberProfileExecute.mockResolvedValueOnce({
      id: barberId,
      userId,
      displayName: null,
      specialization: "Fade Specialist",
      createdAt: now,
      updatedAt: now,
    });

    mockUpdateDisplayNameExecute.mockResolvedValueOnce({
      id: userId,
      email: "barber@example.com",
      displayName: "Ahmad Barber",
      role: "BARBER",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });

    // Second call returns updated profile with new displayName
    mockGetBarberProfileExecute.mockResolvedValueOnce({
      id: barberId,
      userId,
      displayName: "Ahmad Barber",
      specialization: "Fade Specialist",
      createdAt: now,
      updatedAt: now,
    });

    const req = createJsonRequest(
      `/api/v1/admin/barbers/${barberId}/display-name`,
      "PATCH",
      { displayName: "Ahmad Barber" },
    );

    const res = await PATCH(req, { params });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toMatchObject({
      id: barberId,
      userId,
      displayName: "Ahmad Barber",
      specialization: "Fade Specialist",
      missingDisplayName: false,
    });

    expect(mockUpdateDisplayNameExecute).toHaveBeenCalledWith({
      userId,
      displayName: "Ahmad Barber",
    });
  });
});
