export interface BusinessHours {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
