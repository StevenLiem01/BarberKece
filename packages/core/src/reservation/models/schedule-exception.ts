export interface ScheduleException {
  id: string;
  barberProfileId: string | null;
  reason: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
