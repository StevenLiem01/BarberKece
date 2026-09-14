import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET, PUT } from "../route";

const { mockGetHairProfile, mockSaveHairProfile } = vi.hoisted(() => ({
  mockGetHairProfile: vi.fn(),
  mockSaveHairProfile: vi.fn(),
}));

vi.mock("@barberkece/core/identity", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/identity")>();
  return {
    ...actual,
    getHairProfile: mockGetHairProfile,
    saveHairProfile: mockSaveHairProfile,
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresHairProfileRepository: vi.fn(),
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

const mockAuthenticateCustomerApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  authenticateCustomerApi: mockAuthenticateCustomerApi,
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

describe("Hair Profile Route: /api/v1/hair-profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateCustomerApi.mockResolvedValue({
      user: { id: "cust-1", role: "CUSTOMER", status: "ACTIVE" },
    });
  });

  describe("GET /api/v1/hair-profile", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockAuthenticateCustomerApi.mockResolvedValueOnce({
        response: NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Auth required" } },
          { status: 401 },
        ),
      });

      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns null when no profile exists", async () => {
      mockGetHairProfile.mockResolvedValueOnce(null);

      const res = await GET();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(mockGetHairProfile).toHaveBeenCalledWith(
        "cust-1",
        expect.anything(),
      );
      expect(json.data).toBeNull();
    });

    it("returns profile when it exists", async () => {
      mockGetHairProfile.mockResolvedValueOnce({
        id: "profile-1",
        customerId: "cust-1",
        faceShape: "Oval",
        styleTags: ["Classic"],
      });

      const res = await GET();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.faceShape).toBe("Oval");
      expect(json.data.styleTags).toEqual(["Classic"]);
    });
  });

  describe("PUT /api/v1/hair-profile", () => {
    const validBody = {
      faceShape: "Oval",
      hairType: "Straight",
      styleTags: ["Classic", "Fade"],
    };

    it("rejects cross-origin request without matching origin header (CSRF defense)", async () => {
      const req = new NextRequest(
        new URL("http://localhost:3000/api/v1/hair-profile"),
        {
          method: "PUT",
          headers: {
            host: "localhost:3000",
            origin: "http://malicious-site.com",
            "content-type": "application/json",
          },
          body: JSON.stringify(validBody),
        },
      );

      const res = await PUT(req);
      expect(res.status).toBe(403);
    });

    it("rejects unauthenticated requests with 401", async () => {
      mockAuthenticateCustomerApi.mockResolvedValueOnce({
        response: NextResponse.json(
          { error: { code: "UNAUTHORIZED", message: "Auth required" } },
          { status: 401 },
        ),
      });

      const req = createJsonRequest(
        "http://localhost:3000/api/v1/hair-profile",
        "PUT",
        validBody,
      );
      const res = await PUT(req);
      expect(res.status).toBe(401);
    });

    it("rejects invalid request body with 400 (taxonomy enforcement)", async () => {
      const req = createJsonRequest(
        "http://localhost:3000/api/v1/hair-profile",
        "PUT",
        {
          faceShape: "NotAFaceShape", // Invalid enum
        },
      );

      const res = await PUT(req);
      expect(res.status).toBe(400);
    });

    it("binds customerId from session and saves profile", async () => {
      mockSaveHairProfile.mockResolvedValueOnce({
        id: "profile-1",
        customerId: "cust-1",
        ...validBody,
      });

      const req = createJsonRequest(
        "http://localhost:3000/api/v1/hair-profile",
        "PUT",
        validBody,
      );

      const res = await PUT(req);
      expect(res.status).toBe(200);

      expect(mockSaveHairProfile).toHaveBeenCalledWith(
        {
          customerId: "cust-1",
          faceShape: "Oval",
          hairType: "Straight",
          hairDensity: undefined,
          hairLength: undefined,
          maintenance: undefined,
          styleTags: ["Classic", "Fade"],
        },
        expect.anything(),
      );

      const json = await res.json();
      expect(json.data.id).toBe("profile-1");
    });
  });
});
