import { InvalidAppointmentStatusTransitionError } from "../errors.js";

export const AppointmentStatus = {
  CONFIRMED: "CONFIRMED",
  CHECKED_IN: "CHECKED_IN",
  IN_SERVICE: "IN_SERVICE",
  COMPLETED: "COMPLETED",
  CANCELLED_BY_CUSTOMER: "CANCELLED_BY_CUSTOMER",
  CANCELLED_BY_BARBERSHOP: "CANCELLED_BY_BARBERSHOP",
  NO_SHOW: "NO_SHOW",
} as const;

export type AppointmentStatus =
  (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_SERVICE,
] as const;

export function isActiveAppointmentStatus(status: AppointmentStatus): boolean {
  return (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

const ALLOWED_TRANSITIONS: Record<
  AppointmentStatus,
  readonly AppointmentStatus[]
> = {
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.CHECKED_IN,
    AppointmentStatus.CANCELLED_BY_CUSTOMER,
    AppointmentStatus.CANCELLED_BY_BARBERSHOP,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CHECKED_IN]: [
    AppointmentStatus.IN_SERVICE,
    AppointmentStatus.CANCELLED_BY_BARBERSHOP,
  ],
  [AppointmentStatus.IN_SERVICE]: [AppointmentStatus.COMPLETED],
  [AppointmentStatus.COMPLETED]: [],
  [AppointmentStatus.CANCELLED_BY_CUSTOMER]: [],
  [AppointmentStatus.CANCELLED_BY_BARBERSHOP]: [],
  [AppointmentStatus.NO_SHOW]: [],
};

export function canTransitionAppointmentStatus(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidAppointmentStatusTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): void {
  if (!canTransitionAppointmentStatus(from, to)) {
    throw new InvalidAppointmentStatusTransitionError(from, to);
  }
}
