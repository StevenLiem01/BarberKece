ALTER TABLE "hairstyle_compatibility" DROP CONSTRAINT "hairstyle_compatibility_attribute_type_check";
--> statement-breakpoint
UPDATE "hairstyle_compatibility" SET "attribute_type" = 'hair_density' WHERE "attribute_type" = 'hair_thickness';
--> statement-breakpoint
ALTER TABLE "hairstyle_compatibility" ADD CONSTRAINT "hairstyle_compatibility_attribute_type_check" CHECK ("hairstyle_compatibility"."attribute_type" IN ('face_shape', 'hair_type', 'hair_density'));
