import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";

const mockGenerateRecommendations = vi.hoisted(() => vi.fn());

vi.mock("@barberkece/core/recommendation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@barberkece/core/recommendation")>();
  class MockRecommendationError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    ...actual,
    generateRecommendations: mockGenerateRecommendations,
    RecommendationError: actual.RecommendationError || MockRecommendationError,
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresHairstyleKnowledgeRepository: vi.fn(),
  PostgresHairProfileRepository: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDatabaseClient: vi.fn(() => ({ db: {} })),
}));

vi.mock("@barberkece/infrastructure/logging", () => ({
  generateRequestId: vi.fn(() => "test-req-id"),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
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

describe("Recommendations Route: /api/v1/recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles guest transient request successfully without authentication", async () => {
    mockGenerateRecommendations.mockResolvedValueOnce({
      topMatches: [],
      growOutOptions: [],
    });
    const req = createJsonRequest(
      "http://localhost:3000/api/v1/recommendations",
      "POST",
      {
        mode: "transient",
        faceShape: "Oval",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockAuthenticateCustomerApi).not.toHaveBeenCalled();
    expect(mockGenerateRecommendations).toHaveBeenCalledWith(
      {
        mode: "transient",
        input: {
          faceShape: "Oval",
          hairType: undefined,
          hairDensity: undefined,
          hairLength: undefined,
          maintenance: undefined,
          styleTags: undefined,
        },
      },
      expect.anything(),
      expect.anything(),
    );
  });

  it("handles authenticated CUSTOMER transient request without using profile", async () => {
    mockGenerateRecommendations.mockResolvedValueOnce({
      topMatches: [],
      growOutOptions: [],
    });
    const req = createJsonRequest(
      "http://localhost:3000/api/v1/recommendations",
      "POST",
      {
        mode: "transient",
        faceShape: "Square",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockAuthenticateCustomerApi).not.toHaveBeenCalled();
  });

  it("handles saved-profile request when authenticated as CUSTOMER", async () => {
    mockAuthenticateCustomerApi.mockResolvedValueOnce({
      user: { id: "cust-1", role: "CUSTOMER", status: "ACTIVE" },
    });
    mockGenerateRecommendations.mockResolvedValueOnce({
      topMatches: [],
      growOutOptions: [],
    });

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/recommendations",
      "POST",
      {
        mode: "saved-profile",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockAuthenticateCustomerApi).toHaveBeenCalled();
    expect(mockGenerateRecommendations).toHaveBeenCalledWith(
      { mode: "saved-profile", customerId: "cust-1" },
      expect.anything(),
      expect.anything(),
    );
  });

  it("rejects saved-profile request when unauthenticated (401)", async () => {
    mockAuthenticateCustomerApi.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 },
      ),
    });

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/recommendations",
      "POST",
      {
        mode: "saved-profile",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects saved-profile request when authenticated as BARBER (403)", async () => {
    mockAuthenticateCustomerApi.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Customer role required" } },
        { status: 403 },
      ),
    });

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/recommendations",
      "POST",
      {
        mode: "saved-profile",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects saved-profile request when authenticated as ADMIN (403)", async () => {
    mockAuthenticateCustomerApi.mockResolvedValueOnce({
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Customer role required" } },
        { status: 403 },
      ),
    });

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/recommendations",
      "POST",
      {
        mode: "saved-profile",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rejects mixed saved-profile + transient fields (400)", async () => {
    const req = createJsonRequest(
      "http://localhost:3000/api/v1/recommendations",
      "POST",
      {
        mode: "saved-profile",
        faceShape: "Oval",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("rejects invalid mode (400)", async () => {
    const req = createJsonRequest(
      "http://localhost:3000/api/v1/recommendations",
      "POST",
      {
        mode: "unknown-mode",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects invalid taxonomy values (400)", async () => {
    const req = createJsonRequest(
      "http://localhost:3000/api/v1/recommendations",
      "POST",
      {
        mode: "transient",
        faceShape: "Hexagon",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects client-supplied customerId in transient mode (400)", async () => {
    const req = createJsonRequest(
      "http://localhost:3000/api/v1/recommendations",
      "POST",
      {
        mode: "transient",
        customerId: "injected-id",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON body safely (400)", async () => {
    const req = new NextRequest(
      new URL("http://localhost:3000/api/v1/recommendations"),
      {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: "{ invalid json",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("selects preview image deterministically by displayOrder and does not leak internal fields", async () => {
    mockGenerateRecommendations.mockResolvedValueOnce({
      topMatches: [
        {
          score: 85,
          isGrowOutOption: false,
          knowledge: {
            id: "hk-1",
            name: "Classic Pompadour",
            shortDescription: "Clean slicked back pompadour",
            previewImages: [
              { url: "https://example.com/order-2.jpg", displayOrder: 2 },
              { url: "https://example.com/order-0.jpg", displayOrder: 0 },
              { url: "https://example.com/order-1.jpg", displayOrder: 1 },
            ],
          },
          explanation: {
            matchPercentage: 85,
            reasons: ["Matches oval face"],
            cautions: [],
          },
        },
      ],
      growOutOptions: [],
    });

    const req = createJsonRequest(
      "http://localhost:3000/api/v1/recommendations",
      "POST",
      {
        mode: "transient",
        faceShape: "Oval",
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    const topMatch = data.data.topMatches[0];
    expect(topMatch.previewImageUrl).toBe("https://example.com/order-0.jpg");
    expect(topMatch.name).toBe("Classic Pompadour");
    expect(topMatch.score).toBe(85);

    // Verify response DTO does not leak raw internal knowledge properties
    expect(topMatch.longDescription).toBeUndefined();
    expect(topMatch.compatibility).toBeUndefined();
    expect(topMatch.previewImages).toBeUndefined();
    expect(topMatch.stylingDifficulty).toBeUndefined();
  });

  it("rejects cross-origin request (403)", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/v1/recommendations",
      {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://malicious-site.com",
        },
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
