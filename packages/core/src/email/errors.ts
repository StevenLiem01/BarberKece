export class EmailError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EmailError";
  }
}

export class InvalidEmailAddressError extends EmailError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidEmailAddressError";
  }
}

export class InvalidEmailSubjectError extends EmailError {
  constructor(
    message = "Email subject cannot be empty",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "InvalidEmailSubjectError";
  }
}

export class MissingEmailContentError extends EmailError {
  constructor(
    message = "Email must contain either text or html content",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MissingEmailContentError";
  }
}

export class EmailDeliveryError extends EmailError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EmailDeliveryError";
  }
}
