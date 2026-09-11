import { describe, it, expect, vi } from "vitest";
import { GetBarberAppointmentDetailUseCase } from "../use-cases/get-barber-appointment-detail.js";
import type { AppointmentRepository } from "../ports/appointment-repository.js";
import { AppointmentStatus } from "../domain/appointment-status.js";
import {
  AppointmentNotFoundError,
  AppointmentOwnershipError,
} from "../errors.js";
import type { Appointment } from "../models/appointment.js";

describe("GetBarberAppointmentDetailUseCase", () => {
  const mockAppointment: Appointment = {
    id: "appt-1",
    bookingReference: "BK-20260915-001",
    customerId: "cust-1",
    barberProfileId: "barber-owner",
    serviceId: "srv-1",
    status: AppointmentStatus.CONFIRMED,
    startsAt: new Date("2026-09-15T10:00:00Z"),
    endsAt: new Date("2026-09-15T10:30:00Z"),
    serviceDurationMinutes: 30,
    priceRupiah: 50000,
    notes: "Haircut notes",
    cancellationReason: null,
    isAutoAssigned: false,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
  };

  const createMockRepo = (
    appointment: Appointment | null,
  ): AppointmentRepository =>
    ({
      findById: vi.fn().mockResolvedValue(appointment),
    }) as unknown as AppointmentRepository;

  it("successfully returns appointment detail when barberProfileId matches", async () => {
    const mockRepo = createMockRepo(mockAppointment);
    const useCase = new GetBarberAppointmentDetailUseCase(mockRepo);

    const result = await useCase.execute({
      appointmentId: "appt-1",
      barberProfileId: "barber-owner",
    });

    expect(result.appointment).toEqual(mockAppointment);
    expect(mockRepo.findById).toHaveBeenCalledWith("appt-1");
  });

  it("fails with AppointmentNotFoundError when appointment does not exist", async () => {
    const mockRepo = createMockRepo(null);
    const useCase = new GetBarberAppointmentDetailUseCase(mockRepo);

    await expect(
      useCase.execute({
        appointmentId: "appt-nonexistent",
        barberProfileId: "barber-owner",
      }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });

  it("rejects lookup with AppointmentOwnershipError when barberProfileId does not match (foreign barber isolation)", async () => {
    const mockRepo = createMockRepo(mockAppointment);
    const useCase = new GetBarberAppointmentDetailUseCase(mockRepo);

    await expect(
      useCase.execute({
        appointmentId: "appt-1",
        barberProfileId: "barber-intruder",
      }),
    ).rejects.toThrow(AppointmentOwnershipError);
  });

  it("throws error when appointmentId is missing or invalid", async () => {
    const mockRepo = createMockRepo(mockAppointment);
    const useCase = new GetBarberAppointmentDetailUseCase(mockRepo);

    await expect(
      useCase.execute({
        appointmentId: "",
        barberProfileId: "barber-owner",
      }),
    ).rejects.toThrow("appointmentId is required");
  });

  it("throws error when barberProfileId is missing or invalid", async () => {
    const mockRepo = createMockRepo(mockAppointment);
    const useCase = new GetBarberAppointmentDetailUseCase(mockRepo);

    await expect(
      useCase.execute({
        appointmentId: "appt-1",
        barberProfileId: "",
      }),
    ).rejects.toThrow("barberProfileId is required");
  });
});
