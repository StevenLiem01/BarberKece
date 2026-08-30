import { pgTable, text, timestamp, check, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastLoginAt: timestamp("last_login_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => {
    return {
      roleCheck: check(
        "users_role_check",
        sql`${table.role} IN ('CUSTOMER', 'BARBER', 'ADMIN')`,
      ),
      statusCheck: check(
        "users_status_check",
        sql`${table.status} IN ('ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING')`,
      ),
    };
  },
);
