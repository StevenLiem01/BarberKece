import { describe, it, expect, vi } from "vitest";
import { GetAppointmentUseCase } from "../use-cases/get-appointment.js";
import type { AppointmentRepository } from "../ports/appointment-repository.js";
import { AppointmentStatus } from "../domain/appointment-status.js";
import { AppointmentNotFoundError } from "../errors.js";
import type { Appointment } from "../models/appointment.js";

describe("GetAppointmentUseCase", () => {
  const mockAppointment: Appointment = {
    id: "appt-1",
    bookingReference: "BK-123456",
    customerId: "cust-owner",
    barberProfileId: "barber-1",
    serviceId: "srv-1",
    status: AppointmentStatus.CONFIRMED,
    startsAt: new Date("2026-09-15T10:00:00Z"),
    endsAt: new Date("2026-09-15T10:30:00Z"),
    serviceDurationMinutes: 30,
    priceRupiah: 50000,
    notes: "Regular cut",
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

  it("owned appointment succeeds when customerIdContext matches", async () => {
    const mockRepo = createMockRepo(mockAppointment);
    const useCase = new GetAppointmentUseCase(mockRepo);

    const result = await useCase.execute("appt-1", "cust-owner");
    expect(result).toEqual(mockAppointment);
    expect(mockRepo.findById).toHaveBeenCalledWith("appt-1");
  });

  it("succeeds when no customerIdContext is provided (admin/internal query)", async () => {
    const mockRepo = createMockRepo(mockAppointment);
    const useCase = new GetAppointmentUseCase(mockRepo);

    const result = await useCase.execute("appt-1");
    expect(result).toEqual(mockAppointment);
  });

  it("missing appointment fails with AppointmentNotFoundError", async () => {
    const mockRepo = createMockRepo(null);
    const useCase = new GetAppointmentUseCase(mockRepo);

    await expect(
      useCase.execute("appt-nonexistent", "cust-owner"),
    ).rejects.toThrow(AppointmentNotFoundError);
  });

  it("another customer's appointment is rejected without leaking existence (throws AppointmentNotFoundError)", async () => {
    const mockRepo = createMockRepo(mockAppointment);
    const useCase = new GetAppointmentUseCase(mockRepo);

    await expect(useCase.execute("appt-1", "cust-attacker")).rejects.toThrow(
      AppointmentNotFoundError,
    );
  });
});
