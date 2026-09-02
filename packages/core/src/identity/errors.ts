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
