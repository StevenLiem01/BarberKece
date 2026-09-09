import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "../identity/users.js";
import { appointments } from "./appointments.js";

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    operation: text("operation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    actorOperationKeyUnique: unique(
      "idempotency_records_actor_operation_key_unique",
    ).on(table.actorId, table.operation, table.idempotencyKey),
  }),
);
