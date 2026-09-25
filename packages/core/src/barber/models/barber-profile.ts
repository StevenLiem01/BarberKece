export interface BarberProfile {
  id: string;
  userId: string;
  /** Display name sourced from users.display_name — null if not yet set. */
  displayName: string | null;
  specialization: string | null;
  createdAt: Date;
  updatedAt: Date;
}
