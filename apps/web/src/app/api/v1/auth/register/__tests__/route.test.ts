import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { IdentityError } from "@barberkece/core/identity";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock("@barberkece/core/identity", () => {
  return {
    IdentityError: class extends Error {
      constructor(message: string) {
        super(message);
        this.name = "IdentityError";
      }
    },
    RegisterCustomerUseCase: class {
      execute = mockExecute;
    },
  };
});

vi.mock("@barberkece/database/repositories", () => ({
  PostgresUserRepository: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/identity", () => ({
  Argon2PasswordHashingAdapter: vi.fn(),
}));

vi.mock("@barberkece/infrastructure/logging", () => ({
  generateRequestId: vi.fn(() => "test-req-id"),
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@barberkece/database", () => ({
  createDatabase: vi.fn(() => ({ db: {} })),
}));

describe("POST /api/v1/auth/register", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  const createRequest = (body: Record<string, unknown> | null) => {
    return new NextRequest("http://localhost:3000/api/v1/auth/register", {
      method: "POST",
      body: body ? JSON.stringify(body) : null,
    });
  };

  it("should successfully register a customer", async () => {
    mockExecute.mockResolvedValue({
      id: "user-123",
      email: "test@example.com",
      role: "CUSTOMER",
      status: "ACTIVE",
    });

    const req = createRequest({
      email: "test@example.com",
      password: "password123",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const data = await res.json();
    if (res.status === 500) console.log("500 ERROR:", data);
    expect(data.data.id).toBe("user-123");
    expect(data.data.role).toBe("CUSTOMER");
    expect(data.data.passwordHash).toBeUndefined(); // Should not exist
  });

  it("should return 400 on malformed JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/register", {
      method: "POST",
      body: "{ bad json ",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("MALFORMED_JSON");
  });

  it("should return 400 on invalid input", async () => {
    const req = createRequest({ email: "not-an-email", password: "short" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should safely mask duplicate email errors (enumeration safe)", async () => {
    mockExecute.mockRejectedValue(
      new IdentityError("Email is already registered"),
    );

    const req = createRequest({
      email: "duplicate@example.com",
      password: "password123",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("REGISTRATION_FAILED");
    expect(data.error.message).toBe("Registration could not be completed.");
  });

  it("should safely mask generic domain errors", async () => {
    mockExecute.mockRejectedValue(
      new IdentityError("Database error during user creation"),
    );

    const req = createRequest({
      email: "error@example.com",
      password: "password123",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("REGISTRATION_FAILED");
  });

  it("should safely mask unexpected errors", async () => {
    mockExecute.mockRejectedValue(new Error("Database exploded"));

    const req = createRequest({
      email: "error@example.com",
      password: "password123",
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
