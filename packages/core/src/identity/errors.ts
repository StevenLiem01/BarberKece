export class IdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityError";
  }
}

export class PasswordHashingError extends IdentityError {
  constructor(
    message: string = "An error occurred during password processing",
  ) {
    super(message);
    this.name = "PasswordHashingError";
  }
}

export class TokenError extends IdentityError {
  constructor(message: string = "An error occurred during token processing") {
    super(message);
    this.name = "TokenError";
  }
}

export class AuthenticationError extends IdentityError {
  constructor(message: string = "Authentication failed") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class UserAlreadyExistsError extends IdentityError {
  constructor(message: string = "User with this email already exists") {
    super(message);
    this.name = "UserAlreadyExistsError";
  }
}

export class StaffInvitationError extends IdentityError {
  constructor(message: string) {
    super(message);
    this.name = "StaffInvitationError";
  }
}

export class InvalidStaffInvitationError extends StaffInvitationError {
  constructor(message: string = "Invalid or non-existent staff invitation") {
    super(message);
    this.name = "InvalidStaffInvitationError";
  }
}

export class StaffInvitationExpiredError extends StaffInvitationError {
  constructor(message: string = "Staff invitation has expired") {
    super(message);
    this.name = "StaffInvitationExpiredError";
  }
}

export class StaffInvitationAlreadyUsedError extends StaffInvitationError {
  constructor(message: string = "Staff invitation has already been used") {
    super(message);
    this.name = "StaffInvitationAlreadyUsedError";
  }
}
