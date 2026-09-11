import { describe, it, expect, vi } from "vitest";
import { GetBarberAppointmentsUseCase } from "../use-cases/get-barber-appointments.js";
import type { AppointmentRepository } from "../ports/appointment-repository.js";
import { AppointmentStatus } from "../domain/appointment-status.js";
import type { Appointment } from "../models/appointment.js";
import { InvalidBookingDateError } from "../errors.js";

describe("GetBarberAppointmentsUseCase", () => {
  const createMockAppointment = (
    id: string,
    barberProfileId: string,
    startsAt: Date,
    status: AppointmentStatus = AppointmentStatus.CONFIRMED,
  ): Appointment => ({
    id,
    bookingReference: `BK-${id}`,
    customerId: "cust-1",
    barberProfileId,
    serviceId: "srv-1",
    status,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 45 * 60 * 1000),
    serviceDurationMinutes: 45,
    priceRupiah: 60000,
    notes: "Regular cut",
    cancellationReason: null,
    isAutoAssigned: false,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
  });

  it("queries repository with trusted barberProfileId and returns appointments", async () => {
    const barberId = "barber-profile-1";
    const appt1 = createMockAppointment(
      "appt-1",
      barberId,
      new Date("2026-09-15T03:00:00Z"),
    );
    const appt2 = createMockAppointment(
      "appt-2",
      barberId,
      new Date("2026-09-15T04:00:00Z"),
    );

    const mockRepo = {
      findByBarberId: vi.fn().mockResolvedValue([appt1, appt2]),
    } as unknown as AppointmentRepository;

    const useCase = new GetBarberAppointmentsUseCase(mockRepo);
    const result = await useCase.execute({ barberProfileId: barberId });

    expect(mockRepo.findByBarberId).toHaveBeenCalledWith(barberId, {
      from: undefined,
      to: undefined,
      status: undefined,
    });
    expect(result.appointments).toEqual([appt1, appt2]);
  });

  it("computes exact Jakarta day boundaries when date YYYY-MM-DD string is provided", async () => {
    const barberId = "barber-profile-1";
    const mockRepo = {
      findByBarberId: vi.fn().mockResolvedValue([]),
    } as unknown as AppointmentRepository;

    const useCase = new GetBarberAppointmentsUseCase(mockRepo);
    await useCase.execute({
      barberProfileId: barberId,
      date: "2026-09-15",
    });

    // 2026-09-15 00:00:00+07:00 is 2026-09-14 17:00:00.000Z
    // 2026-09-16 00:00:00+07:00 is 2026-09-15 17:00:00.000Z
    expect(mockRepo.findByBarberId).toHaveBeenCalledWith(barberId, {
      from: new Date("2026-09-14T17:00:00.000Z"),
      to: new Date("2026-09-15T17:00:00.000Z"),
      status: undefined,
    });
  });

  it("throws InvalidBookingDateError when malformed date is supplied", async () => {
    const mockRepo = {
      findByBarberId: vi.fn(),
    } as unknown as AppointmentRepository;

    const useCase = new GetBarberAppointmentsUseCase(mockRepo);
    await expect(
      useCase.execute({
        barberProfileId: "barber-1",
        date: "2026-13-45",
      }),
    ).rejects.toThrow(InvalidBookingDateError);
    expect(mockRepo.findByBarberId).not.toHaveBeenCalled();
  });

  it("passes status filter through to repository", async () => {
    const barberId = "barber-profile-1";
    const mockRepo = {
      findByBarberId: vi.fn().mockResolvedValue([]),
    } as unknown as AppointmentRepository;

    const useCase = new GetBarberAppointmentsUseCase(mockRepo);
    await useCase.execute({
      barberProfileId: barberId,
      status: [AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN],
    });

    expect(mockRepo.findByBarberId).toHaveBeenCalledWith(barberId, {
      from: undefined,
      to: undefined,
      status: [AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN],
    });
  });

  it("throws error when both single date and explicit range are supplied", async () => {
    const mockRepo = {
      findByBarberId: vi.fn(),
    } as unknown as AppointmentRepository;

    const useCase = new GetBarberAppointmentsUseCase(mockRepo);
    await expect(
      useCase.execute({
        barberProfileId: "barber-1",
        date: "2026-09-15",
        from: new Date("2026-09-15T00:00:00Z"),
      }),
    ).rejects.toThrow("Cannot specify both date and explicit from/to range");

    expect(mockRepo.findByBarberId).not.toHaveBeenCalled();
  });

  it("throws error when explicit from is at or after to", async () => {
    const mockRepo = {
      findByBarberId: vi.fn(),
    } as unknown as AppointmentRepository;

    const useCase = new GetBarberAppointmentsUseCase(mockRepo);
    await expect(
      useCase.execute({
        barberProfileId: "barber-1",
        from: new Date("2026-09-16T10:00:00Z"),
        to: new Date("2026-09-15T10:00:00Z"),
      }),
    ).rejects.toThrow("from must be before to");

    await expect(
      useCase.execute({
        barberProfileId: "barber-1",
        from: new Date("2026-09-15T10:00:00Z"),
        to: new Date("2026-09-15T10:00:00Z"),
      }),
    ).rejects.toThrow("from must be before to");

    expect(mockRepo.findByBarberId).not.toHaveBeenCalled();
  });

  it("queries with valid explicit from and to range", async () => {
    const from = new Date("2026-09-15T00:00:00Z");
    const to = new Date("2026-09-16T00:00:00Z");
    const mockRepo = {
      findByBarberId: vi.fn().mockResolvedValue([]),
    } as unknown as AppointmentRepository;

    const useCase = new GetBarberAppointmentsUseCase(mockRepo);
    await useCase.execute({
      barberProfileId: "barber-1",
      from,
      to,
    });

    expect(mockRepo.findByBarberId).toHaveBeenCalledWith("barber-1", {
      from,
      to,
      status: undefined,
    });
  });

  it("throws error if barberProfileId is missing or empty", async () => {
    const mockRepo = {
      findByBarberId: vi.fn(),
    } as unknown as AppointmentRepository;

    const useCase = new GetBarberAppointmentsUseCase(mockRepo);
    await expect(useCase.execute({ barberProfileId: "" })).rejects.toThrow(
      "barberProfileId is required",
    );
    expect(mockRepo.findByBarberId).not.toHaveBeenCalled();
  });
});
