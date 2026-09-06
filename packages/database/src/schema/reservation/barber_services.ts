import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { services } from "./services.js";
import { barberProfiles } from "../barber/barber_profiles.js";

export const barberServices = pgTable(
  "barber_services",
  {
    barberProfileId: uuid("barber_profile_id")
      .notNull()
      .references(() => barberProfiles.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.barberProfileId, table.serviceId] }),
    };
  },
);
