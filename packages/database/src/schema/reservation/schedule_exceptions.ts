import { pgTable, text, timestamp, check, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { barberProfiles } from "../barber/barber_profiles.js";

export const scheduleExceptions = pgTable(
  "schedule_exceptions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    barberProfileId: uuid("barber_profile_id").references(
      () => barberProfiles.id,
      { onDelete: "cascade" },
    ),
    reason: text("reason").notNull(),
    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    timeRangeCheck: check(
      "schedule_exceptions_time_check",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
  }),
);
