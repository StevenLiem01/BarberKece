export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceRupiah: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
