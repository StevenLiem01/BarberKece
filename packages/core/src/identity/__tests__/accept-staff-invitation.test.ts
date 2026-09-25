import { describe, it, expect, vi, beforeEach } from "vitest";
import { AcceptStaffInvitationUseCase } from "../use-cases/accept-staff-invitation.js";
import { UserRepository } from "../ports/user-repository.js";
import { StaffInvitationRepository } from "../ports/staff-invitation-repository.js";
import { StaffInvitationTransactionRunner } from "../ports/staff-invitation-transaction-runner.js";
import { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";
import { PasswordHashingPort } from "../ports/password-hashing-port.js";
import { TokenPort } from "../ports/token-port.js";
import {
  IdentityError,
  InvalidStaffInvitationError,
  StaffInvitationExpiredError,
  StaffInvitationAlreadyUsedError,
  UserAlreadyExistsError,
} from "../errors.js";
import { StaffInvitation } from "../models/staff-invitation.js";

describe("AcceptStaffInvitationUseCase", () => {
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

  const mockPasswordHashing: PasswordHashingPort = {
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
  };

  const mockTokenPort: TokenPort = {
    generateToken: vi.fn(),
    hashToken: vi.fn(),
  };

  let useCase: AcceptStaffInvitationUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new AcceptStaffInvitationUseCase(
      mockTransactionRunner,
      mockPasswordHashing,
      mockTokenPort,
    );
  });

  const validBarberInvitation: StaffInvitation = {
    id: "inv-uuid-1",
    email: "barber@barberkece.id",
    displayName: "Ahmad Fauzi",
    role: "BARBER",
    tokenHash: "hashed-raw-token",
    expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    usedAt: null,
    createdAt: new Date(),
  };

  it("should throw IdentityError if token is empty", async () => {
    await expect(
      useCase.execute({ token: "", passwordRaw: "SecurePass123!" }),
    ).rejects.toThrow(new IdentityError("Token undangan wajib diisi"));
  });

  it("should throw IdentityError if password is shorter than 8 characters", async () => {
    await expect(
      useCase.execute({ token: "some-token", passwordRaw: "short" }),
    ).rejects.toThrow(new IdentityError("Password minimal 8 karakter"));
  });

  it("should throw InvalidStaffInvitationError if invitation not found", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("unknown-hash");
    vi.mocked(
      mockStaffInvitationRepository.findAndLockByTokenHash,
    ).mockResolvedValue(null);

    await expect(
      useCase.execute({
        token: "unknown-token",
        passwordRaw: "SecurePass123!",
      }),
    ).rejects.toThrow(InvalidStaffInvitationError);

    expect(mockUserRepository.createUser).not.toHaveBeenCalled();
    expect(
      mockStaffInvitationRepository.consumeInvitation,
    ).not.toHaveBeenCalled();
  });

  it("should throw StaffInvitationAlreadyUsedError if already used", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("used-hash");
    vi.mocked(
      mockStaffInvitationRepository.findAndLockByTokenHash,
    ).mockResolvedValue({
      ...validBarberInvitation,
      usedAt: new Date(),
    });

    await expect(
      useCase.execute({ token: "used-token", passwordRaw: "SecurePass123!" }),
    ).rejects.toThrow(StaffInvitationAlreadyUsedError);

    expect(mockUserRepository.createUser).not.toHaveBeenCalled();
    expect(
      mockStaffInvitationRepository.consumeInvitation,
    ).not.toHaveBeenCalled();
  });

  it("should throw StaffInvitationExpiredError if expired", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("expired-hash");
    vi.mocked(
      mockStaffInvitationRepository.findAndLockByTokenHash,
    ).mockResolvedValue({
      ...validBarberInvitation,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      useCase.execute({
        token: "expired-token",
        passwordRaw: "SecurePass123!",
      }),
    ).rejects.toThrow(StaffInvitationExpiredError);

    expect(mockUserRepository.createUser).not.toHaveBeenCalled();
    expect(
      mockStaffInvitationRepository.consumeInvitation,
    ).not.toHaveBeenCalled();
  });

  it("should throw UserAlreadyExistsError if user with email is already registered", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("hash-123");
    vi.mocked(
      mockStaffInvitationRepository.findAndLockByTokenHash,
    ).mockResolvedValue(validBarberInvitation);
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue({
      id: "existing-user-id",
      email: "barber@barberkece.id",
      displayName: "Ahmad",
      passwordHash: "existing-password-hash",
      role: "BARBER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      useCase.execute({ token: "token-123", passwordRaw: "SecurePass123!" }),
    ).rejects.toThrow(UserAlreadyExistsError);

    expect(mockUserRepository.createUser).not.toHaveBeenCalled();
    expect(
      mockStaffInvitationRepository.consumeInvitation,
    ).not.toHaveBeenCalled();
  });

  it("should successfully accept BARBER invitation, create user with Admin displayName and emailVerifiedAt, and provision barber profile", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("hashed-token-barber");
    vi.mocked(
      mockStaffInvitationRepository.findAndLockByTokenHash,
    ).mockResolvedValue(validBarberInvitation);
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValue(
      "argon2-hashed-pass",
    );

    const acceptanceTimestamp = new Date();
    const createdUser = {
      id: "new-barber-uuid",
      email: "barber@barberkece.id",
      displayName: "Ahmad Fauzi",
      role: "BARBER" as const,
      status: "ACTIVE" as const,
      emailVerifiedAt: acceptanceTimestamp,
      lastLoginAt: null,
      createdAt: acceptanceTimestamp,
      updatedAt: acceptanceTimestamp,
    };
    vi.mocked(mockUserRepository.createUser).mockResolvedValue(createdUser);

    const result = await useCase.execute({
      token: "valid-raw-token",
      passwordRaw: "SuperSecurePass123!",
    });

    // 1. Token looked up and locked with row lock
    expect(mockTokenPort.hashToken).toHaveBeenCalledWith("valid-raw-token");
    expect(
      mockStaffInvitationRepository.findAndLockByTokenHash,
    ).toHaveBeenCalledWith("hashed-token-barber");

    // 2. User created with Admin-provided displayName and acceptance timestamp as emailVerifiedAt
    expect(mockUserRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "barber@barberkece.id",
        displayName: "Ahmad Fauzi",
        passwordHash: "argon2-hashed-pass",
        role: "BARBER",
        status: "ACTIVE",
        emailVerifiedAt: expect.any(Date),
      }),
    );

    // 3. emailVerifiedAt matches the acceptance timestamp passed to consumeInvitation
    const userCreateCall = vi.mocked(mockUserRepository.createUser).mock.calls[0][0];
    const consumeCall = vi.mocked(mockStaffInvitationRepository.consumeInvitation).mock.calls[0];
    expect(userCreateCall.emailVerifiedAt).toBeInstanceOf(Date);
    expect(userCreateCall.emailVerifiedAt).toEqual(consumeCall[1]);

    // 4. Invitation marked as consumed
    expect(
      mockStaffInvitationRepository.consumeInvitation,
    ).toHaveBeenCalledWith("inv-uuid-1", expect.any(Date));

    // 5. Barber profile provisioned atomically for BARBER role
    expect(mockBarberProfileRepository.provisionProfile).toHaveBeenCalledWith({
      id: expect.any(String),
      userId: "new-barber-uuid",
      specialization: null,
    });

    expect(result.user).toEqual(createdUser);
    expect(result.user.emailVerifiedAt).toEqual(acceptanceTimestamp);
  });

  it("should successfully accept ADMIN invitation with emailVerifiedAt without provisioning barber profile", async () => {
    const adminInvitation: StaffInvitation = {
      id: "inv-admin-1",
      email: "admin@barberkece.id",
      displayName: "Siti Admin",
      role: "ADMIN",
      tokenHash: "hashed-token-admin",
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      usedAt: null,
      createdAt: new Date(),
    };

    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("hashed-token-admin");
    vi.mocked(
      mockStaffInvitationRepository.findAndLockByTokenHash,
    ).mockResolvedValue(adminInvitation);
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValue(
      "argon2-hashed-admin-pass",
    );

    const acceptanceTimestamp = new Date();
    const createdAdmin = {
      id: "new-admin-uuid",
      email: "admin@barberkece.id",
      displayName: "Siti Admin",
      role: "ADMIN" as const,
      status: "ACTIVE" as const,
      emailVerifiedAt: acceptanceTimestamp,
      lastLoginAt: null,
      createdAt: acceptanceTimestamp,
      updatedAt: acceptanceTimestamp,
    };
    vi.mocked(mockUserRepository.createUser).mockResolvedValue(createdAdmin);

    const result = await useCase.execute({
      token: "valid-admin-token",
      passwordRaw: "SuperSecureAdmin123!",
    });

    expect(mockUserRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "admin@barberkece.id",
        displayName: "Siti Admin",
        role: "ADMIN",
        emailVerifiedAt: expect.any(Date),
      }),
    );

    const userCreateCall = vi.mocked(mockUserRepository.createUser).mock.calls[0][0];
    const consumeCall = vi.mocked(mockStaffInvitationRepository.consumeInvitation).mock.calls[0];
    expect(userCreateCall.emailVerifiedAt).toBeInstanceOf(Date);
    expect(userCreateCall.emailVerifiedAt).toEqual(consumeCall[1]);

    expect(
      mockStaffInvitationRepository.consumeInvitation,
    ).toHaveBeenCalledWith("inv-admin-1", expect.any(Date));

    // Barber profile should NOT be provisioned for ADMIN
    expect(mockBarberProfileRepository.provisionProfile).not.toHaveBeenCalled();
    expect(result.user).toEqual(createdAdmin);
    expect(result.user.emailVerifiedAt).toEqual(acceptanceTimestamp);
  });

  it("should remain atomic: transaction failure during user creation rejects the entire acceptance", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("hashed-token-barber");
    vi.mocked(
      mockStaffInvitationRepository.findAndLockByTokenHash,
    ).mockResolvedValue(validBarberInvitation);
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValue("pass-hash");
    vi.mocked(mockUserRepository.createUser).mockRejectedValue(
      new Error("Database write error"),
    );

    await expect(
      useCase.execute({
        token: "valid-raw-token",
        passwordRaw: "SuperSecurePass123!",
      }),
    ).rejects.toThrow("Database write error");

    expect(mockTransactionRunner.run).toHaveBeenCalledTimes(1);
    expect(mockBarberProfileRepository.provisionProfile).not.toHaveBeenCalled();
    expect(
      mockStaffInvitationRepository.consumeInvitation,
    ).not.toHaveBeenCalled();
  });

  it("should remain atomic: transaction failure during barber provisioning rejects the entire acceptance", async () => {
    vi.mocked(mockTokenPort.hashToken).mockResolvedValue("hashed-token-barber");
    vi.mocked(
      mockStaffInvitationRepository.findAndLockByTokenHash,
    ).mockResolvedValue(validBarberInvitation);
    vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(mockPasswordHashing.hashPassword).mockResolvedValue("pass-hash");
    vi.mocked(mockUserRepository.createUser).mockResolvedValue({
      id: "barber-user-id",
      email: validBarberInvitation.email,
      displayName: validBarberInvitation.displayName,
      role: "BARBER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(mockBarberProfileRepository.provisionProfile).mockRejectedValue(
      new Error("Profile provisioning failed"),
    );

    await expect(
      useCase.execute({
        token: "valid-raw-token",
        passwordRaw: "SuperSecurePass123!",
      }),
    ).rejects.toThrow("Profile provisioning failed");

    expect(mockTransactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
