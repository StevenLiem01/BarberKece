CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_BARBERSHOP', 'NO_SHOW');--> statement-breakpoint
CREATE TABLE "business_hours" (
	"id" uuid PRIMARY KEY NOT NULL,
	"day_of_week" smallint NOT NULL,
	"open_time" time NOT NULL,
	"close_time" time NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_hours_day_of_week_unique" UNIQUE("day_of_week"),
	CONSTRAINT "business_hours_day_of_week_check" CHECK ("business_hours"."day_of_week" >= 0 AND "business_hours"."day_of_week" <= 6),
	CONSTRAINT "business_hours_time_check" CHECK ("business_hours"."close_time" > "business_hours"."open_time")
);
--> statement-breakpoint
CREATE TABLE "barber_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"barber_profile_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "barber_schedules_barber_day_start_unique" UNIQUE("barber_profile_id","day_of_week","start_time"),
	CONSTRAINT "barber_schedules_day_of_week_check" CHECK ("barber_schedules"."day_of_week" >= 0 AND "barber_schedules"."day_of_week" <= 6),
	CONSTRAINT "barber_schedules_time_check" CHECK ("barber_schedules"."end_time" > "barber_schedules"."start_time")
);
--> statement-breakpoint
CREATE TABLE "schedule_exceptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"barber_profile_id" uuid,
	"reason" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_exceptions_time_check" CHECK ("schedule_exceptions"."ends_at" > "schedule_exceptions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_reference" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"barber_profile_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"status" "appointment_status" DEFAULT 'CONFIRMED' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"service_duration_minutes" integer NOT NULL,
	"price_rupiah" integer NOT NULL,
	"notes" text,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_booking_reference_unique" UNIQUE("booking_reference"),
	CONSTRAINT "appointments_duration_check" CHECK ("appointments"."service_duration_minutes" > 0),
	CONSTRAINT "appointments_price_check" CHECK ("appointments"."price_rupiah" >= 0),
	CONSTRAINT "appointments_time_check" CHECK ("appointments"."ends_at" > "appointments"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "barber_schedules" ADD CONSTRAINT "barber_schedules_barber_profile_id_barber_profiles_id_fk" FOREIGN KEY ("barber_profile_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_barber_profile_id_barber_profiles_id_fk" FOREIGN KEY ("barber_profile_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_barber_profile_id_barber_profiles_id_fk" FOREIGN KEY ("barber_profile_id") REFERENCES "public"."barber_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "no_overlapping_barber_appointments"
EXCLUDE USING gist (
  "barber_profile_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
)
WHERE ("status" IN ('CONFIRMED', 'CHECKED_IN', 'IN_SERVICE'));--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "no_overlapping_customer_appointments"
EXCLUDE USING gist (
  "customer_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
)
WHERE ("status" IN ('CONFIRMED', 'CHECKED_IN', 'IN_SERVICE'));