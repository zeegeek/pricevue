ALTER TABLE "pending_matches" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "pending_matches" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_listings" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "pending_matches" ADD CONSTRAINT "pending_matches_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;