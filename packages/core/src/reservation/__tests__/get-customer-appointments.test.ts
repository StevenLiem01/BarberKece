import { describe, it, expect, vi } from "vitest";
import { GetCustomerAppointmentsUseCase } from "../use-cases/get-customer-appointments.js";
import type { AppointmentRepository } from "../ports/appointment-repository.js";
import { AppointmentStatus } from "../domain/appointment-status.js";
import type { Appointment } from "../models/appointment.js";

describe("GetCustomerAppointmentsUseCase", () => {
  const createMockAppointment = (
    id: string,
    customerId: string,
    startsAt: Date,
  ): Appointment => ({
    id,
    bookingReference: `BK-${id}`,
    customerId,
    barberProfileId: "barber-1",
    serviceId: "srv-1",
    status: AppointmentStatus.CONFIRMED,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
    serviceDurationMinutes: 30,
    priceRupiah: 50000,
    notes: null,
    cancellationReason: null,
    isAutoAssigned: false,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
  });

  it("returns customer appointments", async () => {
    const customerId = "cust-1";
    const appt1 = createMockAppointment(
      "appt-1",
      customerId,
      new Date("2026-09-15T10:00:00Z"),
    );
    const appt2 = createMockAppointment(
      "appt-2",
      customerId,
      new Date("2026-09-14T10:00:00Z"),
    );

    const mockRepo = {
      findByCustomerId: vi.fn().mockResolvedValue([appt1, appt2]),
    } as unknown as AppointmentRepository;

    const useCase = new GetCustomerAppointmentsUseCase(mockRepo);
    const result = await useCase.execute(customerId);

    expect(mockRepo.findByCustomerId).toHaveBeenCalledWith(customerId);
    expect(result).toEqual([appt1, appt2]);
  });

  it("preserves deterministic startsAt DESC result returned by repository", async () => {
    const customerId = "cust-1";
    const laterAppt = createMockAppointment(
      "appt-latest",
      customerId,
      new Date("2026-09-20T10:00:00Z"),
    );
    const earlierAppt = createMockAppointment(
      "appt-earlier",
      customerId,
      new Date("2026-09-10T10:00:00Z"),
    );

    const mockRepo = {
      findByCustomerId: vi.fn().mockResolvedValue([laterAppt, earlierAppt]),
    } as unknown as AppointmentRepository;

    const useCase = new GetCustomerAppointmentsUseCase(mockRepo);
    const result = await useCase.execute(customerId);

    expect(result[0].id).toBe("appt-latest");
    expect(result[1].id).toBe("appt-earlier");
    expect(result[0].startsAt.getTime()).toBeGreaterThan(
      result[1].startsAt.getTime(),
    );
  });
});
