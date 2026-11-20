CREATE TABLE "alert_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"watchlist_item_id" integer NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"reason" text NOT NULL,
	"listing_id" integer,
	"price_paise" integer NOT NULL,
	"previous_paise" integer,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "email_alerts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "last_seen_paise" integer;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_watchlist_item_id_watchlist_items_id_fk" FOREIGN KEY ("watchlist_item_id") REFERENCES "public"."watchlist_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_listing_id_store_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."store_listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_events_item_sent_idx" ON "alert_events" USING btree ("watchlist_item_id","sent_at");