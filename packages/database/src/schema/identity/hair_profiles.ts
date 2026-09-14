import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";
import { users } from "./users.js";

export const hairProfiles = pgTable("hair_profiles", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  customerId: uuid("customer_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  faceShape: text("face_shape"),
  hairType: text("hair_type"),
  hairDensity: text("hair_density"),
  hairLength: text("hair_length"),
  maintenance: text("maintenance"),
  styleTags: text("style_tags").array(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});
