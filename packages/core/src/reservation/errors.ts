export class ReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationError";
  }
}

export class ServiceNotFoundError extends ReservationError {
  constructor(id: string) {
    super(`Service not found: ${id}`);
    this.name = "ServiceNotFoundError";
  }
}
