import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  numeric,
  check,
  primaryKey,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

export const hairstyleKnowledge = pgTable(
  "hairstyle_knowledge",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text("name").notNull().unique(),
    shortDescription: text("short_description").notNull(),
    longDescription: text("long_description").notNull(),
    virtualFilterAssetRef: text("virtual_filter_asset_ref"),
    minimumHairLength: text("minimum_hair_length").notNull(),
    recommendedHairLength: text("recommended_hair_length").notNull(),
    maintenanceLevel: text("maintenance_level").notNull(),
    stylingDifficulty: text("styling_difficulty").notNull(),
    professionalNotes: text("professional_notes"),
    commonMistakes: text("common_mistakes"),
    recommendedProductsPlaceholder: text("recommended_products_placeholder"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    minimumHairLengthCheck: check(
      "hairstyle_knowledge_minimum_hair_length_check",
      sql`${table.minimumHairLength} IN ('Very Short', 'Short', 'Medium', 'Long')`,
    ),
    recommendedHairLengthCheck: check(
      "hairstyle_knowledge_recommended_hair_length_check",
      sql`${table.recommendedHairLength} IN ('Very Short', 'Short', 'Medium', 'Long')`,
    ),
    maintenanceLevelCheck: check(
      "hairstyle_knowledge_maintenance_level_check",
      sql`${table.maintenanceLevel} IN ('Very Low', 'Low', 'Medium', 'High')`,
    ),
    stylingDifficultyCheck: check(
      "hairstyle_knowledge_styling_difficulty_check",
      sql`${table.stylingDifficulty} IN ('Low', 'Medium', 'High')`,
    ),
  }),
);

export const hairstyleAliases = pgTable(
  "hairstyle_aliases",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    hairstyleId: uuid("hairstyle_id")
      .notNull()
      .references(() => hairstyleKnowledge.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (table) => ({
    hairstyleIdIdx: index("hairstyle_aliases_hairstyle_id_idx").on(
      table.hairstyleId,
    ),
    uniqueAlias: unique("hairstyle_aliases_hairstyle_id_alias_unique").on(
      table.hairstyleId,
      table.alias,
    ),
  }),
);

export const hairstylePreviewImages = pgTable(
  "hairstyle_preview_images",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    hairstyleId: uuid("hairstyle_id")
      .notNull()
      .references(() => hairstyleKnowledge.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    displayOrder: integer("display_order").notNull(),
  },
  (table) => ({
    hairstyleIdIdx: index("hairstyle_preview_images_hairstyle_id_idx").on(
      table.hairstyleId,
    ),
    uniqueDisplayOrder: unique(
      "hairstyle_preview_images_hairstyle_id_display_order_unique",
    ).on(table.hairstyleId, table.displayOrder),
  }),
);

export const hairstyleStyleTags = pgTable(
  "hairstyle_style_tags",
  {
    hairstyleId: uuid("hairstyle_id")
      .notNull()
      .references(() => hairstyleKnowledge.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.hairstyleId, table.tag] }),
    hairstyleIdIdx: index("hairstyle_style_tags_hairstyle_id_idx").on(
      table.hairstyleId,
    ),
  }),
);

export const hairstyleCompatibility = pgTable(
  "hairstyle_compatibility",
  {
    hairstyleId: uuid("hairstyle_id")
      .notNull()
      .references(() => hairstyleKnowledge.id, { onDelete: "cascade" }),
    attributeType: text("attribute_type").notNull(), // 'face_shape', 'hair_type', 'hair_thickness'
    attributeValue: text("attribute_value").notNull(),
    compatibilityScore: numeric("compatibility_score", {
      precision: 3,
      scale: 2,
    }).notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.hairstyleId, table.attributeType, table.attributeValue],
    }),
    scoreCheck: check(
      "valid_score",
      sql`${table.compatibilityScore} IN (0.00, 0.50, 0.75, 1.00)`,
    ),
    attributeTypeCheck: check(
      "hairstyle_compatibility_attribute_type_check",
      sql`${table.attributeType} IN ('face_shape', 'hair_type', 'hair_thickness')`,
    ),
    hairstyleIdIdx: index("hairstyle_compatibility_hairstyle_id_idx").on(
      table.hairstyleId,
    ),
  }),
);
