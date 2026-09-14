CREATE TABLE "hair_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"face_shape" text,
	"hair_type" text,
	"hair_density" text,
	"hair_length" text,
	"maintenance" text,
	"style_tags" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hair_profiles_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
ALTER TABLE "hair_profiles" ADD CONSTRAINT "hair_profiles_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;