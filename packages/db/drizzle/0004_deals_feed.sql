ALTER TABLE "deals" ADD COLUMN "points" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "is_lowest_ever" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "is_low_90" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "expired_at" timestamp with time zone;--> statement-breakpoint
DELETE FROM "deals" a USING "deals" b WHERE a."listing_id" = b."listing_id" AND a."id" < b."id";--> statement-breakpoint
CREATE UNIQUE INDEX "deals_listing_idx" ON "deals" USING btree ("listing_id");