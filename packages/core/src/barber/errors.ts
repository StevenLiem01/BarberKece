export class BarberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BarberError";
  }
}

export class BarberProfileNotFoundError extends BarberError {
  constructor(id: string) {
    super(`Barber profile not found: ${id}`);
    this.name = "BarberProfileNotFoundError";
  }
}

export class BarberUserNotFoundError extends BarberError {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = "BarberUserNotFoundError";
  }
}

export class InvalidBarberRoleError extends BarberError {
  constructor(userId: string, role: string) {
    super(`User ${userId} does not have the BARBER role: ${role}`);
    this.name = "InvalidBarberRoleError";
  }
}

export class BarberProfileAlreadyExistsError extends BarberError {
  constructor(userId: string) {
    super(`Barber profile already exists for user: ${userId}`);
    this.name = "BarberProfileAlreadyExistsError";
  }
}
