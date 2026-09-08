import {
  pgTable,
  timestamp,
  check,
  uuid,
  time,
  smallint,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

export const businessHours = pgTable(
  "business_hours",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    dayOfWeek: smallint("day_of_week").notNull().unique(),
    openTime: time("open_time").notNull(),
    closeTime: time("close_time").notNull(),
    isClosed: boolean("is_closed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    dayOfWeekCheck: check(
      "business_hours_day_of_week_check",
      sql`${table.dayOfWeek} >= 0 AND ${table.dayOfWeek} <= 6`,
    ),
    timeCheck: check(
      "business_hours_time_check",
      sql`${table.closeTime} > ${table.openTime}`,
    ),
  }),
);
