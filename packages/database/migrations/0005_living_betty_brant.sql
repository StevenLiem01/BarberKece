CREATE TABLE "hairstyle_aliases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"hairstyle_id" uuid NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hairstyle_compatibility" (
	"hairstyle_id" uuid NOT NULL,
	"attribute_type" text NOT NULL,
	"attribute_value" text NOT NULL,
	"compatibility_score" numeric(3, 2) NOT NULL,
	CONSTRAINT "hairstyle_compatibility_hairstyle_id_attribute_type_attribute_value_pk" PRIMARY KEY("hairstyle_id","attribute_type","attribute_value"),
	CONSTRAINT "valid_score" CHECK ("hairstyle_compatibility"."compatibility_score" IN (0.00, 0.50, 0.75, 1.00))
);
--> statement-breakpoint
CREATE TABLE "hairstyle_knowledge" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_description" text NOT NULL,
	"long_description" text NOT NULL,
	"virtual_filter_asset_ref" text,
	"minimum_hair_length" text NOT NULL,
	"recommended_hair_length" text NOT NULL,
	"maintenance_level" text NOT NULL,
	"styling_difficulty" text NOT NULL,
	"professional_notes" text,
	"common_mistakes" text,
	"recommended_products_placeholder" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hairstyle_knowledge_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "hairstyle_preview_images" (
	"id" uuid PRIMARY KEY NOT NULL,
	"hairstyle_id" uuid NOT NULL,
	"url" text NOT NULL,
	"display_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hairstyle_style_tags" (
	"hairstyle_id" uuid NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "hairstyle_style_tags_hairstyle_id_tag_pk" PRIMARY KEY("hairstyle_id","tag")
);
--> statement-breakpoint
ALTER TABLE "hairstyle_aliases" ADD CONSTRAINT "hairstyle_aliases_hairstyle_id_hairstyle_knowledge_id_fk" FOREIGN KEY ("hairstyle_id") REFERENCES "public"."hairstyle_knowledge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hairstyle_compatibility" ADD CONSTRAINT "hairstyle_compatibility_hairstyle_id_hairstyle_knowledge_id_fk" FOREIGN KEY ("hairstyle_id") REFERENCES "public"."hairstyle_knowledge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hairstyle_preview_images" ADD CONSTRAINT "hairstyle_preview_images_hairstyle_id_hairstyle_knowledge_id_fk" FOREIGN KEY ("hairstyle_id") REFERENCES "public"."hairstyle_knowledge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hairstyle_style_tags" ADD CONSTRAINT "hairstyle_style_tags_hairstyle_id_hairstyle_knowledge_id_fk" FOREIGN KEY ("hairstyle_id") REFERENCES "public"."hairstyle_knowledge"("id") ON DELETE cascade ON UPDATE no action;