import { UserRepository } from "./user-repository.js";
import { PasswordResetTokenRepository } from "./password-reset-token-repository.js";
import { SessionRepository } from "./session-repository.js";

export interface PasswordResetTransactionContext {
  userRepository: UserRepository;
  passwordResetTokenRepository: PasswordResetTokenRepository;
  sessionRepository: SessionRepository;
}

export interface PasswordResetTransactionRunner {
  /**
   * Executes transactional work inside a single database transaction.
   * If any error is thrown, the entire transaction is rolled back.
   */
  run<T>(
    work: (context: PasswordResetTransactionContext) => Promise<T>,
  ): Promise<T>;
}
