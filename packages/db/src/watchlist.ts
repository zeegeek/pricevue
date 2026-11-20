import { and, desc, eq, sql } from "drizzle-orm";
import type { StoreId } from "@pricevue/core";
import type { Db } from "./client";
import { brands, offers, products, storeListings, variants, watchlistItems } from "./schema";

export interface WatchlistEntry {
  id: number;
  variantId: number;
  slug: string;
  title: string;
  brand: string;
  variantLabel: string;
  colourHex: string | null;
  targetPaise: number | null;
  bestPaise: number | null;
  bestStoreId: StoreId | null;
  createdAt: Date;
}

/** Adds (or updates the target and email-alert flag of) a tracked variant for a user. */
export async function upsertWatchlistItem(
  db: Db,
  userId: string,
  variantId: number,
  targetPaise: number | null,
  emailAlerts = true,
) {
  const [row] = await db
    .insert(watchlistItems)
    .values({ userId, variantId, targetPaise, emailAlerts })
    .onConflictDoUpdate({ target: [watchlistItems.userId, watchlistItems.variantId], set: { targetPaise, emailAlerts } })
    .returning();
  return row!;
}

export async function removeWatchlistItem(db: Db, userId: string, variantId: number) {
  await db.delete(watchlistItems).where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.variantId, variantId)));
}

export async function getWatchlistItem(db: Db, userId: string, variantId: number) {
  const [row] = await db
    .select()
    .from(watchlistItems)
    .where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.variantId, variantId)));
  return row ?? null;
}

/** A user's tracked variants with the current best in-stock payable price. */
export async function getWatchlist(db: Db, userId: string): Promise<WatchlistEntry[]> {
  const best = db
    .selectDistinctOn([storeListings.variantId], {
      variantId: storeListings.variantId,
      storeId: storeListings.storeId,
      payable: sql<number>`(${offers.listedPaise} + ${offers.shippingPaise})::int`.as("payable"),
    })
    .from(offers)
    .innerJoin(storeListings, eq(offers.listingId, storeListings.id))
    .where(and(eq(offers.isCurrent, true), eq(offers.inStock, true)))
    .orderBy(storeListings.variantId, sql`${offers.listedPaise} + ${offers.shippingPaise}`)
    .as("best");

  return db
    .select({
      id: watchlistItems.id,
      variantId: variants.id,
      slug: products.slug,
      title: products.title,
      brand: brands.name,
      variantLabel: variants.label,
      colourHex: variants.colourHex,
      targetPaise: watchlistItems.targetPaise,
      bestPaise: best.payable,
      bestStoreId: best.storeId,
      createdAt: watchlistItems.createdAt,
    })
    .from(watchlistItems)
    .innerJoin(variants, eq(watchlistItems.variantId, variants.id))
    .innerJoin(products, eq(variants.productId, products.id))
    .innerJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(best, eq(best.variantId, variants.id))
    .where(eq(watchlistItems.userId, userId))
    .orderBy(desc(watchlistItems.createdAt), desc(watchlistItems.id));
}
