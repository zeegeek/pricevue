CREATE TABLE "pending_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"candidate_variant_id" integer NOT NULL,
	"confidence" real NOT NULL,
	"reasons" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "gtin" text;--> statement-breakpoint
ALTER TABLE "pending_matches" ADD CONSTRAINT "pending_matches_listing_id_store_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."store_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_matches" ADD CONSTRAINT "pending_matches_candidate_variant_id_variants_id_fk" FOREIGN KEY ("candidate_variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_matches_pair_idx" ON "pending_matches" USING btree ("listing_id","candidate_variant_id");