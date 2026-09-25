import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidateStaffInvitationUseCase } from "../use-cases/validate-staff-invitation.js";
import { StaffInvitationRepository } from "../ports/staff-invitation-repository.js";
import { UserRepository } from "../ports/user-repository.js";
import { TokenPort } from "../ports/token-port.js";
import { StaffInvitation } from "../models/staff-invitation.js";

describe("ValidateStaffInvitationUseCase", () => {
  const mockStaffInvitationRepository: StaffInvitationRepository = {
    acquireEmailIssuanceLock: vi.fn(),
    createInvitation: vi.fn(),
    invalidateActiveInvitationsForEmail: vi.fn(),
    findAndLockByTokenHash: vi.fn(),
    findByTokenHash: vi.fn(),
    consumeInvitation: vi.fn(),
  };

  const mockTokenPort: TokenPort = {
    generateToken: vi.fn(),
    hashToken: vi.fn(),
  };

  const mockUserRepository: UserRepository = {
    createUser: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    countByRole: vi.fn(),
    updatePassword: vi.fn(),
    updateDisplayName: vi.fn(),
  };

  let useCase: ValidateStaffInvitationUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ValidateStaffInvitationUseCase(
      mockStaffInvitationRepository,
      mockTokenPort,
      mockUserRepository,
    );
  });

  const baseInvitation: StaffInvitation = {
    id: "inv-123",
    email: "barber@example.com",
    displayName: "Budi Santoso",
    role: "BARBER",
    tokenHash: "hashed-token-123",
    expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    usedAt: null,
    createdAt: new Date(),
  };

  it("should return NOT_FOUND if token is empty or whitespace", async () => {
    const res = await useCase.execute({ token: "   " });
    expect(res).toEqual({ isValid: false, reason: "NOT_FOUND" });
  });

  it("should return NOT_FOUND if token is not found in database", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("unknown-hash");
    vi.mocked(mockStaffInvitationRepository.findByTokenHash).mockResolvedValue(
      null,
    );

    const res = await useCase.execute({ token: "invalid-token" });
    expect(res).toEqual({ isValid: false, reason: "NOT_FOUND" });
  });

  it("should return USED if invitation has already been used", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("used-hash");
    vi.mocked(mockStaffInvitationRepository.findByTokenHash).mockResolvedValue({
      ...baseInvitation,
      usedAt: new Date(),
    });

    const res = await useCase.execute({ token: "used-token" });
    expect(res).toEqual({
      isValid: false,
      reason: "USED",
      email: "barber@example.com",
      displayName: "Budi Santoso",
      role: "BARBER",
    });
  });

  it("should return EXPIRED if invitation expiresAt is in the past", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("expired-hash");
    vi.mocked(mockStaffInvitationRepository.findByTokenHash).mockResolvedValue({
      ...baseInvitation,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await useCase.execute({ token: "expired-token" });
    expect(res).toEqual({
      isValid: false,
      reason: "EXPIRED",
      email: "barber@example.com",
      displayName: "Budi Santoso",
      role: "BARBER",
    });
  });

  it("should return USER_ALREADY_EXISTS if user with that email already exists", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("existing-hash");
    vi.mocked(mockStaffInvitationRepository.findByTokenHash).mockResolvedValue(
      baseInvitation,
    );
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue({
      id: "u-1",
      email: "barber@example.com",
      displayName: "Budi",
      passwordHash: "existing-password-hash",
      role: "BARBER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await useCase.execute({ token: "token-for-registered-user" });
    expect(res).toEqual({
      isValid: false,
      reason: "USER_ALREADY_EXISTS",
      email: "barber@example.com",
      displayName: "Budi Santoso",
      role: "BARBER",
    });
  });

  it("should return isValid: true with email, displayName, and role for valid active invitation", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("valid-hash");
    vi.mocked(mockStaffInvitationRepository.findByTokenHash).mockResolvedValue(
      baseInvitation,
    );
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);

    const res = await useCase.execute({ token: "valid-token" });
    expect(res).toEqual({
      isValid: true,
      email: "barber@example.com",
      displayName: "Budi Santoso",
      role: "BARBER",
    });
  });
});
