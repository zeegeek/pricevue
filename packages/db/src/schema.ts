import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const storeIdEnum = pgEnum("store_id", ["amazon", "flipkart", "myntra", "ajio", "croma"]);
export const dealScoreEnum = pgEnum("deal_score", ["great", "good", "fair"]);
export const alertStatusEnum = pgEnum("alert_status", ["active", "triggered", "paused"]);

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const stores = pgTable("stores", {
  id: storeIdEnum("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  isLive: boolean("is_live").notNull().default(false),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  brandId: integer("brand_id").notNull().references(() => brands.id),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  modelName: text("model_name").notNull(),
  launchMrpPaise: integer("launch_mrp_paise"),
  specs: jsonb("specs").$type<Record<string, string>>().notNull().default({}),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    label: text("label").notNull(),
    storageGb: integer("storage_gb"),
    ramGb: integer("ram_gb"),
    colour: text("colour"),
    colourHex: text("colour_hex"),
    gtin: text("gtin"),
    launchMrpPaise: integer("launch_mrp_paise"),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

export const storeListings = pgTable(
  "store_listings",
  {
    id: serial("id").primaryKey(),
    variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
    storeId: storeIdEnum("store_id").notNull().references(() => stores.id),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    matchConfidence: real("match_confidence").notNull().default(1),
    matchMethod: text("match_method").notNull().default("manual"),
    lastCheckedAt: ts("last_checked_at"),
  },
  (t) => [
    uniqueIndex("store_listings_store_external_idx").on(t.storeId, t.externalId),
    index("store_listings_variant_idx").on(t.variantId),
  ],
);

/** Low-confidence listing↔variant pairs awaiting human review (never auto-linked). */
export const pendingMatches = pgTable(
  "pending_matches",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id").notNull().references(() => storeListings.id, { onDelete: "cascade" }),
    candidateVariantId: integer("candidate_variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    confidence: real("confidence").notNull(),
    reasons: text("reasons").array().notNull().default(sql`ARRAY[]::text[]`),
    /** pending | approved | rejected. Resolved rows are kept so the same pair is never re-queued. */
    status: text("status").notNull().default("pending"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: ts("resolved_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pending_matches_pair_idx").on(t.listingId, t.candidateVariantId)],
);

export const offers = pgTable(
  "offers",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id").notNull().references(() => storeListings.id, { onDelete: "cascade" }),
    seller: text("seller"),
    listedPaise: integer("listed_paise").notNull(),
    shippingPaise: integer("shipping_paise").notNull().default(0),
    mrpPaise: integer("mrp_paise"),
    inStock: boolean("in_stock").notNull().default(true),
    stockLabel: text("stock_label"),
    warranty: text("warranty"),
    bankOffer: text("bank_offer"),
    couponOffer: text("coupon_offer"),
    isCurrent: boolean("is_current").notNull().default(true),
    capturedAt: ts("captured_at").notNull().defaultNow(),
  },
  (t) => [index("offers_listing_idx").on(t.listingId, t.isCurrent)],
);

export const pricePoints = pgTable(
  "price_points",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id").notNull().references(() => storeListings.id, { onDelete: "cascade" }),
    capturedAt: ts("captured_at").notNull(),
    pricePaise: integer("price_paise").notNull(),
    inStock: boolean("in_stock").notNull().default(true),
  },
  (t) => [index("price_points_listing_time_idx").on(t.listingId, t.capturedAt)],
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
  image: text("image"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// Auth.js (NextAuth v5) adapter tables.
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<"oauth" | "oidc" | "email" | "webauthn">().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
    targetPaise: integer("target_paise"),
    emailAlerts: boolean("email_alerts").notNull().default(true),
    /** Best price seen by the last alert check; baseline for drop detection. */
    lastSeenPaise: integer("last_seen_paise"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("watchlist_items_user_variant_idx").on(t.userId, t.variantId)],
);

/** Price alerts actually sent, per watchlist item; drives dedupe and cooldown. */
export const alertEvents = pgTable(
  "alert_events",
  {
    id: serial("id").primaryKey(),
    watchlistItemId: integer("watchlist_item_id")
      .notNull()
      .references(() => watchlistItems.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("email"),
    reason: text("reason").$type<"target" | "drop">().notNull(),
    listingId: integer("listing_id").references(() => storeListings.id, { onDelete: "set null" }),
    pricePaise: integer("price_paise").notNull(),
    previousPaise: integer("previous_paise"),
    sentAt: ts("sent_at").notNull().defaultNow(),
  },
  (t) => [index("alert_events_item_sent_idx").on(t.watchlistItemId, t.sentAt)],
);

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
  targetPaise: integer("target_paise").notNull(),
  channels: text("channels").array().notNull().default(sql`ARRAY['email']::text[]`),
  status: alertStatusEnum("status").notNull().default("active"),
  lastTriggeredAt: ts("last_triggered_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const deals = pgTable(
  "deals",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id").notNull().references(() => storeListings.id, { onDelete: "cascade" }),
    pricePaise: integer("price_paise").notNull(),
    referencePaise: integer("reference_paise").notNull(),
    dropPct: real("drop_pct").notNull(),
    score: dealScoreEnum("score").notNull(),
    /** Ranking value (drop % plus record-low bonuses). */
    points: real("points").notNull().default(0),
    isLowestEver: boolean("is_lowest_ever").notNull().default(false),
    isLow90: boolean("is_low_90").notNull().default(false),
    detectedAt: ts("detected_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    /** Set when the price recovers; expired deals are hidden but kept for history. */
    expiredAt: ts("expired_at"),
  },
  (t) => [
    index("deals_detected_idx").on(t.detectedAt),
    uniqueIndex("deals_listing_idx").on(t.listingId),
  ],
);
