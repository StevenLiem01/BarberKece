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
