import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateStaffInvitationUseCase } from "../use-cases/create-staff-invitation.js";
import { UserRepository } from "../ports/user-repository.js";
import { StaffInvitationRepository } from "../ports/staff-invitation-repository.js";
import { StaffInvitationTransactionRunner } from "../ports/staff-invitation-transaction-runner.js";
import { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";
import { TokenPort } from "../ports/token-port.js";
import { EmailPort } from "../../email/ports/email-port.js";
import { IdentityError, UserAlreadyExistsError } from "../errors.js";

describe("CreateStaffInvitationUseCase", () => {
  const mockUserRepository: UserRepository = {
    createUser: vi.fn(),
    findByEmail: vi.fn(),
    findById: vi.fn(),
    countByRole: vi.fn(),
    updatePassword: vi.fn(),
    updateDisplayName: vi.fn(),
  };

  const mockStaffInvitationRepository: StaffInvitationRepository = {
    acquireEmailIssuanceLock: vi.fn(),
    createInvitation: vi.fn(),
    invalidateActiveInvitationsForEmail: vi.fn(),
    findAndLockByTokenHash: vi.fn(),
    findByTokenHash: vi.fn(),
    consumeInvitation: vi.fn(),
  };

  const mockBarberProfileRepository: BarberProfileRepository = {
    provisionProfile: vi.fn(),
    updateSpecialization: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
    lockProfiles: vi.fn(),
  };

  const mockTransactionRunner: StaffInvitationTransactionRunner = {
    run: vi.fn(async (work) =>
      work({
        userRepository: mockUserRepository,
        staffInvitationRepository: mockStaffInvitationRepository,
        barberProfileRepository: mockBarberProfileRepository,
      }),
    ),
  };

  const mockTokenPort: TokenPort = {
    generateToken: vi.fn(),
    hashToken: vi.fn(),
  };

  const mockEmailPort: EmailPort = {
    sendEmail: vi.fn(),
  };

  const appUrl = "http://localhost:3000";

  let useCase: CreateStaffInvitationUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CreateStaffInvitationUseCase(
      mockTransactionRunner,
      mockTokenPort,
      mockEmailPort,
      appUrl,
    );
  });

  it("should throw IdentityError if display name is missing or blank", async () => {
    await expect(
      useCase.execute({
        displayName: "",
        email: "staff@example.com",
        role: "BARBER",
      }),
    ).rejects.toThrow(new IdentityError("Display name is required"));

    await expect(
      useCase.execute({
        displayName: "   ",
        email: "staff@example.com",
        role: "BARBER",
      }),
    ).rejects.toThrow(new IdentityError("Display name must not be blank"));

    expect(mockTransactionRunner.run).not.toHaveBeenCalled();
    expect(mockEmailPort.sendEmail).not.toHaveBeenCalled();
  });

  it("should throw IdentityError if display name exceeds 100 characters", async () => {
    const longName = "A".repeat(101);
    await expect(
      useCase.execute({
        displayName: longName,
        email: "staff@example.com",
        role: "BARBER",
      }),
    ).rejects.toThrow(
      new IdentityError("Display name must not exceed 100 characters"),
    );

    expect(mockTransactionRunner.run).not.toHaveBeenCalled();
    expect(mockEmailPort.sendEmail).not.toHaveBeenCalled();
  });

  it("should throw IdentityError if email is missing or invalid", async () => {
    await expect(
      useCase.execute({
        displayName: "Budi Santoso",
        email: "",
        role: "BARBER",
      }),
    ).rejects.toThrow(new IdentityError("Email is required"));

    await expect(
      useCase.execute({
        displayName: "Budi Santoso",
        email: "invalid-email",
        role: "BARBER",
      }),
    ).rejects.toThrow(new IdentityError("Invalid email address"));

    expect(mockTransactionRunner.run).not.toHaveBeenCalled();
    expect(mockEmailPort.sendEmail).not.toHaveBeenCalled();
  });

  it("should throw IdentityError if role is not BARBER or ADMIN", async () => {
    await expect(
      useCase.execute({
        displayName: "Budi Santoso",
        email: "budi@example.com",
        // @ts-expect-error Testing invalid runtime role
        role: "CUSTOMER",
      }),
    ).rejects.toThrow(new IdentityError("Role must be either BARBER or ADMIN"));

    expect(mockTransactionRunner.run).not.toHaveBeenCalled();
    expect(mockEmailPort.sendEmail).not.toHaveBeenCalled();
  });

  it("should throw UserAlreadyExistsError if email is already registered, rolling back transaction without sending email", async () => {
    vi.mocked(mockTokenPort.generateToken).mockResolvedValue("raw-token");
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("token-hash");
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue({
      id: "existing-user-id",
      email: "budi@example.com",
      displayName: "Budi Old",
      passwordHash: "existing-password-hash",
      role: "CUSTOMER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      useCase.execute({
        displayName: "Budi Santoso",
        email: "budi@example.com",
        role: "BARBER",
      }),
    ).rejects.toThrow(UserAlreadyExistsError);

    // Advisory lock was acquired inside transaction
    expect(
      mockStaffInvitationRepository.acquireEmailIssuanceLock,
    ).toHaveBeenCalledWith("budi@example.com");

    // Invitation was NOT created and email was NOT sent
    expect(
      mockStaffInvitationRepository.createInvitation,
    ).not.toHaveBeenCalled();
    expect(mockEmailPort.sendEmail).not.toHaveBeenCalled();
  });

  it("should not send email if database transaction fails during invitation creation (failure recovery)", async () => {
    vi.mocked(mockTokenPort.generateToken).mockResolvedValue("raw-token");
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("token-hash");
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(mockStaffInvitationRepository.createInvitation).mockRejectedValue(
      new Error("Database connection error"),
    );

    await expect(
      useCase.execute({
        displayName: "Budi Santoso",
        email: "budi@example.com",
        role: "BARBER",
      }),
    ).rejects.toThrow("Database connection error");

    // Email dispatch must NOT be triggered when transaction fails
    expect(mockEmailPort.sendEmail).not.toHaveBeenCalled();
  });

  it("should serialize duplicate issuance, invalidate prior active invitations, and create replacement within transaction", async () => {
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(mockTokenPort.generateToken).mockResolvedValue(
      "raw-secret-token-xyz",
    );
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("sha256-hash-xyz");
    vi.mocked(
      mockStaffInvitationRepository.invalidateActiveInvitationsForEmail,
    ).mockResolvedValue(1);

    const createdDate = new Date();
    const expiryDate = new Date(Date.now() + 48 * 3600 * 1000);

    vi.mocked(
      mockStaffInvitationRepository.createInvitation,
    ).mockImplementation(async (inv) => ({
      ...inv,
      createdAt: createdDate,
      expiresAt: expiryDate,
    }));

    const result = await useCase.execute({
      displayName: "  Budi Barber Master  ",
      email: "  Budi@Example.COM  ",
      role: "BARBER",
    });

    // 1. Transaction runner invoked
    expect(mockTransactionRunner.run).toHaveBeenCalledTimes(1);

    // 2. Advisory lock acquired on normalized email inside transaction
    expect(
      mockStaffInvitationRepository.acquireEmailIssuanceLock,
    ).toHaveBeenCalledWith("budi@example.com");

    // 3. User non-existence verified inside transaction
    expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
      "budi@example.com",
    );

    // 4. Prior active invitations invalidated inside transaction
    expect(
      mockStaffInvitationRepository.invalidateActiveInvitationsForEmail,
    ).toHaveBeenCalledWith("budi@example.com", expect.any(Date));

    // 5. New invitation created with trimmed name and token hash inside transaction
    expect(mockStaffInvitationRepository.createInvitation).toHaveBeenCalledWith(
      {
        id: expect.any(String),
        email: "budi@example.com",
        displayName: "Budi Barber Master",
        role: "BARBER",
        tokenHash: "sha256-hash-xyz",
        expiresAt: expect.any(Date),
        usedAt: null,
        createdAt: expect.any(Date),
      },
    );

    // 6. Email dispatched strictly after transaction commit
    expect(mockEmailPort.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "budi@example.com",
        subject: "Undangan Bergabung Staf BarberKece",
        text: expect.stringContaining(
          "http://localhost:3000/invitations/raw-secret-token-xyz",
        ),
      }),
    );

    // 7. Result contains public invitation metadata without raw token or hash
    expect(result).toEqual({
      id: expect.any(String),
      email: "budi@example.com",
      displayName: "Budi Barber Master",
      role: "BARBER",
      expiresAt: expiryDate,
      createdAt: createdDate,
    });
    expect(
      (result as unknown as Record<string, unknown>).token,
    ).toBeUndefined();
    expect(
      (result as unknown as Record<string, unknown>).tokenHash,
    ).toBeUndefined();
  });
});
