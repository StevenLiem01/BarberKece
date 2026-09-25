import type { Database } from "../client.js";
import {
  StaffInvitationTransactionRunner,
  StaffInvitationTransactionContext,
} from "@barberkece/core/identity";
import { PostgresUserRepository } from "./user-repository.js";
import { PostgresStaffInvitationRepository } from "./staff-invitation-repository.js";
import { PostgresBarberProfileRepository } from "./barber/barber-profile-repository.js";

export class PostgresStaffInvitationTransactionRunner implements StaffInvitationTransactionRunner {
  constructor(private readonly db: Database) {}

  async run<T>(
    work: (context: StaffInvitationTransactionContext) => Promise<T>,
  ): Promise<T> {
    return await this.db.transaction(async (tx) => {
      const userRepository = new PostgresUserRepository(tx);
      const staffInvitationRepository = new PostgresStaffInvitationRepository(
        tx,
      );
      const barberProfileRepository = new PostgresBarberProfileRepository(tx);

      return await work({
        userRepository,
        staffInvitationRepository,
        barberProfileRepository,
      });
    });
  }
}
