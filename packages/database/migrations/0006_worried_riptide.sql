CREATE INDEX "hairstyle_aliases_hairstyle_id_idx" ON "hairstyle_aliases" USING btree ("hairstyle_id");--> statement-breakpoint
CREATE INDEX "hairstyle_compatibility_hairstyle_id_idx" ON "hairstyle_compatibility" USING btree ("hairstyle_id");--> statement-breakpoint
CREATE INDEX "hairstyle_preview_images_hairstyle_id_idx" ON "hairstyle_preview_images" USING btree ("hairstyle_id");--> statement-breakpoint
CREATE INDEX "hairstyle_style_tags_hairstyle_id_idx" ON "hairstyle_style_tags" USING btree ("hairstyle_id");--> statement-breakpoint
ALTER TABLE "hairstyle_aliases" ADD CONSTRAINT "hairstyle_aliases_hairstyle_id_alias_unique" UNIQUE("hairstyle_id","alias");--> statement-breakpoint
ALTER TABLE "hairstyle_preview_images" ADD CONSTRAINT "hairstyle_preview_images_hairstyle_id_display_order_unique" UNIQUE("hairstyle_id","display_order");--> statement-breakpoint
ALTER TABLE "hairstyle_compatibility" ADD CONSTRAINT "hairstyle_compatibility_attribute_type_check" CHECK ("hairstyle_compatibility"."attribute_type" IN ('face_shape', 'hair_type', 'hair_thickness'));--> statement-breakpoint
ALTER TABLE "hairstyle_knowledge" ADD CONSTRAINT "hairstyle_knowledge_minimum_hair_length_check" CHECK ("hairstyle_knowledge"."minimum_hair_length" IN ('Very Short', 'Short', 'Medium', 'Long'));--> statement-breakpoint
ALTER TABLE "hairstyle_knowledge" ADD CONSTRAINT "hairstyle_knowledge_recommended_hair_length_check" CHECK ("hairstyle_knowledge"."recommended_hair_length" IN ('Very Short', 'Short', 'Medium', 'Long'));--> statement-breakpoint
ALTER TABLE "hairstyle_knowledge" ADD CONSTRAINT "hairstyle_knowledge_maintenance_level_check" CHECK ("hairstyle_knowledge"."maintenance_level" IN ('Very Low', 'Low', 'Medium', 'High'));--> statement-breakpoint
ALTER TABLE "hairstyle_knowledge" ADD CONSTRAINT "hairstyle_knowledge_styling_difficulty_check" CHECK ("hairstyle_knowledge"."styling_difficulty" IN ('Low', 'Medium', 'High'));