import {
  pgTable,
  text,
  timestamp,
  check,
  uuid,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { users } from "../identity/users.js";
import { barberProfiles } from "../barber/barber_profiles.js";
import { services } from "./services.js";

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "CONFIRMED",
  "CHECKED_IN",
  "IN_SERVICE",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_BARBERSHOP",
  "NO_SHOW",
]);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    bookingReference: text("booking_reference").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    barberProfileId: uuid("barber_profile_id")
      .notNull()
      .references(() => barberProfiles.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    status: appointmentStatusEnum("status").notNull().default("CONFIRMED"),
    startsAt: timestamp("starts_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    endsAt: timestamp("ends_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    serviceDurationMinutes: integer("service_duration_minutes").notNull(),
    priceRupiah: integer("price_rupiah").notNull(),
    notes: text("notes"),
    cancellationReason: text("cancellation_reason"),
    isAutoAssigned: boolean("is_auto_assigned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    durationCheck: check(
      "appointments_duration_check",
      sql`${table.serviceDurationMinutes} > 0`,
    ),
    priceCheck: check(
      "appointments_price_check",
      sql`${table.priceRupiah} >= 0`,
    ),
    timeCheck: check(
      "appointments_time_check",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
  }),
);
