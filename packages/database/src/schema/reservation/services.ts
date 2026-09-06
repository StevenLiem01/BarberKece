import {
  pgTable,
  text,
  timestamp,
  check,
  uuid,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

export const services = pgTable(
  "services",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    priceRupiah: integer("price_rupiah").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => {
    return {
      durationCheck: check(
        "services_duration_check",
        sql`${table.durationMinutes} > 0`,
      ),
      priceCheck: check("services_price_check", sql`${table.priceRupiah} >= 0`),
    };
  },
);
