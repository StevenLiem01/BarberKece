import type { Database } from "../client.js";
import {
  PasswordResetTransactionRunner,
  PasswordResetTransactionContext,
} from "@barberkece/core/identity";
import { PostgresUserRepository } from "./user-repository.js";
import { PostgresPasswordResetTokenRepository } from "./password-reset-token-repository.js";
import { PostgresSessionRepository } from "./session-repository.js";

export class PostgresPasswordResetTransactionRunner implements PasswordResetTransactionRunner {
  constructor(private readonly db: Database) {}

  async run<T>(
    work: (context: PasswordResetTransactionContext) => Promise<T>,
  ): Promise<T> {
    return await this.db.transaction(async (tx) => {
      const userRepository = new PostgresUserRepository(tx);
      const passwordResetTokenRepository =
        new PostgresPasswordResetTokenRepository(tx);
      const sessionRepository = new PostgresSessionRepository(tx);

      return await work({
        userRepository,
        passwordResetTokenRepository,
        sessionRepository,
      });
    });
  }
}
