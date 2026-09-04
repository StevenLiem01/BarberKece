import { eq, sql } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { users } from "../schema/identity/users.js";
import {
  UserRepository,
  CreateUserParams,
  User,
  UserWithPasswordHash,
  IdentityError,
  UserRole,
  UserStatus,
} from "@barberkece/core/identity";

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: DbOrTx) {}

  async createUser(params: CreateUserParams): Promise<User> {
    try {
      const [inserted] = await this.db
        .insert(users)
        .values({
          id: params.id,
          email: params.email,
          passwordHash: params.passwordHash,
          role: params.role,
          status: params.status,
          createdAt: params.createdAt,
          updatedAt: params.updatedAt,
        })
        .returning({
          id: users.id,
          email: users.email,
          role: users.role,
          status: users.status,
          emailVerifiedAt: users.emailVerifiedAt,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!inserted) {
        throw new IdentityError("Failed to return inserted user record");
      }

      return {
        id: inserted.id,
        email: inserted.email,
        role: inserted.role as UserRole,
        status: inserted.status as UserStatus,
        emailVerifiedAt: inserted.emailVerifiedAt,
        lastLoginAt: inserted.lastLoginAt,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
      };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null) {
        const err = error as Record<string, unknown>;
        const cause = err.cause as Record<string, unknown> | undefined;
        if (
          err.code === "23505" ||
          cause?.code === "23505" ||
          String(err.message).includes("unique constraint") ||
          String(cause?.message).includes("unique constraint")
        ) {
          throw new IdentityError("Email is already registered");
        }
      }
      throw new IdentityError("Database error during user creation");
    }
  }

  async findByEmail(email: string): Promise<UserWithPasswordHash | null> {
    try {
      const user = await this.db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role as UserRole,
        status: user.status as UserStatus,
        emailVerifiedAt: user.emailVerifiedAt,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch {
      throw new IdentityError("Database error during user lookup");
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const user = await this.db.query.users.findFirst({
        where: eq(users.id, id),
        columns: {
          passwordHash: false,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        status: user.status as UserStatus,
        emailVerifiedAt: user.emailVerifiedAt,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch {
      throw new IdentityError("Database error during user lookup by ID");
    }
  }

  async countByRole(role: UserRole): Promise<number> {
    try {
      const [result] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.role, role));
      return result?.count ?? 0;
    } catch {
      throw new IdentityError("Database error during user count by role");
    }
  }
}
