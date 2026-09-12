import type { ScheduleRepository } from "../ports/schedule-repository.js";
import type { BarberSchedule } from "../models/barber-schedule.js";
import type { ScheduleException } from "../models/schedule-exception.js";

export interface GetBarberScheduleViewerRequest {
  barberProfileId: string;
  horizonEnd: Date;
}

export interface GetBarberScheduleViewerResponse {
  schedules: BarberSchedule[];
  exceptions: ScheduleException[];
}

export class GetBarberScheduleViewer {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async execute(
    request: GetBarberScheduleViewerRequest,
  ): Promise<GetBarberScheduleViewerResponse> {
    const schedules = await this.scheduleRepository.getBarberSchedules(
      request.barberProfileId,
    );

    const now = new Date();

    const exceptions = await this.scheduleRepository.getScheduleExceptions({
      barberProfileId: request.barberProfileId,
      start: now,
      end: request.horizonEnd,
    });

    return {
      schedules,
      exceptions,
    };
  }
}
