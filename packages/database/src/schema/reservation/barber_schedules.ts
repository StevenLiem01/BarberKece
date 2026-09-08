import {
  pgTable,
  timestamp,
  check,
  uuid,
  time,
  smallint,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { barberProfiles } from "../barber/barber_profiles.js";

export const barberSchedules = pgTable(
  "barber_schedules",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    barberProfileId: uuid("barber_profile_id")
      .notNull()
      .references(() => barberProfiles.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    dayOfWeekCheck: check(
      "barber_schedules_day_of_week_check",
      sql`${table.dayOfWeek} >= 0 AND ${table.dayOfWeek} <= 6`,
    ),
    timeCheck: check(
      "barber_schedules_time_check",
      sql`${table.endTime} > ${table.startTime}`,
    ),
    uniqueSchedule: unique("barber_schedules_barber_day_start_unique").on(
      table.barberProfileId,
      table.dayOfWeek,
      table.startTime,
    ),
  }),
);
