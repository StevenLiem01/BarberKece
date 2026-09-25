import { UserRepository } from "./user-repository.js";
import { StaffInvitationRepository } from "./staff-invitation-repository.js";
import { BarberProfileRepository } from "../../barber/ports/barber-profile-repository.js";

export interface StaffInvitationTransactionContext {
  userRepository: UserRepository;
  staffInvitationRepository: StaffInvitationRepository;
  barberProfileRepository: BarberProfileRepository;
}

export interface StaffInvitationTransactionRunner {
  /**
   * Executes staff invitation acceptance work inside a single database transaction.
   * If any error is thrown, the entire transaction is rolled back.
   */
  run<T>(
    work: (context: StaffInvitationTransactionContext) => Promise<T>,
  ): Promise<T>;
}
