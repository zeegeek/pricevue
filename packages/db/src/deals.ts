import { and, asc, count, desc, eq, gte, inArray, isNull, lt, min, sql, type SQL } from "drizzle-orm";
import { detectDeal, type PricePoint, type StoreId } from "@pricevue/core";
import type { Db } from "./client";
import type { ProductCard } from "./queries";
import { brands, deals, offers, pricePoints, products, storeListings, variants } from "./schema";

const DAY_MS = 86_400_000;
/** Offers older than this are too stale to advertise as a deal. */
const MAX_OFFER_AGE_MS = 3 * DAY_MS;

export interface DealRunOptions {
  now?: Date;
  /** Limit detection to these listings (e.g. just-refreshed ones); defaults to all. */
  listingIds?: number[];
}

/** Recomputes deals from price history: upserts live ones and expires those whose price recovered. */
export async function runDealDetection(db: Db, { now = new Date(), listingIds }: DealRunOptions = {}) {
  if (listingIds && listingIds.length === 0) return { checked: 0, active: 0, expired: 0 };
  const scope = (col: typeof offers.listingId | typeof pricePoints.listingId | typeof deals.listingId) =>
    listingIds ? inArray(col, listingIds) : undefined;
  const since = new Date(now.getTime() - 90 * DAY_MS);

  const current = await db
    .select({ listingId: offers.listingId, pricePaise: offers.listedPaise, inStock: offers.inStock, at: offers.capturedAt })
    .from(offers)
    .where(and(eq(offers.isCurrent, true), scope(offers.listingId)));
  const recent = await db
    .select({ listingId: pricePoints.listingId, at: pricePoints.capturedAt, pricePaise: pricePoints.pricePaise })
    .from(pricePoints)
    .where(and(eq(pricePoints.inStock, true), gte(pricePoints.capturedAt, since), scope(pricePoints.listingId)));
  const older = await db
    .select({ listingId: pricePoints.listingId, low: min(pricePoints.pricePaise) })
    .from(pricePoints)
    .where(and(eq(pricePoints.inStock, true), lt(pricePoints.capturedAt, since), scope(pricePoints.listingId)))
    .groupBy(pricePoints.listingId);
  const existing = await db
    .select({ listingId: deals.listingId, expiredAt: deals.expiredAt })
    .from(deals)
    .where(scope(deals.listingId));

  const history = new Map<number, PricePoint[]>();
  for (const p of recent) {
    const list = history.get(p.listingId) ?? [];
    list.push({ at: p.at, pricePaise: p.pricePaise });
    history.set(p.listingId, list);
  }
  const olderLow = new Map(older.map((o) => [o.listingId, o.low]));
  const active = new Set(existing.filter((d) => !d.expiredAt).map((d) => d.listingId));

  let live = 0;
  const toExpire: number[] = [];
  for (const offer of current) {
    const fresh = offer.inStock && now.getTime() - offer.at.getTime() <= MAX_OFFER_AGE_MS;
    const signal = fresh
      ? detectDeal({
          currentPaise: offer.pricePaise,
          history: history.get(offer.listingId) ?? [],
          allTimeLowPaise: olderLow.get(offer.listingId),
          now: offer.at,
        })
      : null;
    if (!signal) {
      if (active.has(offer.listingId)) toExpire.push(offer.listingId);
      continue;
    }
    live++;
    const values = {
      pricePaise: signal.pricePaise,
      referencePaise: signal.referencePaise,
      dropPct: signal.dropPct,
      score: signal.score,
      points: signal.points,
      isLowestEver: signal.isLowestEver,
      isLow90: signal.isLow90,
      updatedAt: now,
    };
    await db
      .insert(deals)
      .values({ listingId: offer.listingId, ...values, detectedAt: now })
      .onConflictDoUpdate({
        target: deals.listingId,
        set: {
          ...values,
          detectedAt: sql`CASE WHEN ${deals.expiredAt} IS NULL THEN ${deals.detectedAt} ELSE excluded.detected_at END`,
          expiredAt: null,
        },
      });
  }
  // Active deals whose listing no longer has a current offer are stale too.
  const seen = new Set(current.map((o) => o.listingId));
  for (const id of active) if (!seen.has(id)) toExpire.push(id);
  if (toExpire.length) {
    await db.update(deals).set({ expiredAt: now, updatedAt: now }).where(and(inArray(deals.listingId, toExpire), isNull(deals.expiredAt)));
  }
  return { checked: current.length, active: live, expired: toExpire.length };
}

export const DEAL_SORTS = ["drop", "lowest", "newest"] as const;
export type DealSort = (typeof DEAL_SORTS)[number];

export interface DealFilters {
  store?: StoreId;
  brand?: string;
  minPaise?: number;
  maxPaise?: number;
  minDropPct?: number;
  sort?: DealSort;
  page?: number;
  pageSize?: number;
}

export type DealCard = ProductCard & { isLowestEver: boolean; isLow90: boolean; detectedAt: Date };

/** Live deals, best one per product, filtered, sorted and paginated. */
export async function listDeals(db: Db, f: DealFilters = {}): Promise<{ items: DealCard[]; total: number }> {
  const pageSize = Math.min(Math.max(f.pageSize ?? 24, 1), 96);
  const page = Math.max(f.page ?? 1, 1);
  const where: (SQL | undefined)[] = [
    isNull(deals.expiredAt),
    f.store ? eq(storeListings.storeId, f.store) : undefined,
    f.brand ? eq(brands.slug, f.brand) : undefined,
    f.minPaise != null ? gte(deals.pricePaise, f.minPaise) : undefined,
    f.maxPaise != null ? sql`${deals.pricePaise} <= ${f.maxPaise}` : undefined,
    f.minDropPct != null ? gte(deals.dropPct, f.minDropPct) : undefined,
  ];
  const best = db
    .selectDistinctOn([products.id], {
      slug: products.slug,
      title: products.title,
      brand: sql<string>`${brands.name}`.as("brand"),
      variantId: sql<number>`${variants.id}`.as("variant_id"),
      variantLabel: variants.label,
      colourHex: variants.colourHex,
      storeId: storeListings.storeId,
      pricePaise: deals.pricePaise,
      referencePaise: deals.referencePaise,
      mrpPaise: variants.launchMrpPaise,
      dropPct: deals.dropPct,
      score: deals.score,
      points: deals.points,
      isLowestEver: deals.isLowestEver,
      isLow90: deals.isLow90,
      detectedAt: deals.detectedAt,
    })
    .from(deals)
    .innerJoin(storeListings, eq(storeListings.id, deals.listingId))
    .innerJoin(variants, eq(variants.id, storeListings.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(and(...where))
    .orderBy(products.id, desc(deals.points))
    .as("best");

  const order =
    f.sort === "lowest"
      ? [desc(best.isLowestEver), desc(best.isLow90), desc(best.points)]
      : f.sort === "newest"
        ? [desc(best.detectedAt), desc(best.points)]
        : [desc(best.dropPct)];
  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(best)
      .orderBy(...order, asc(best.slug))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(best),
  ]);
  return {
    items: rows.map(({ points: _points, ...r }) => ({ ...r, storeId: r.storeId as StoreId, storeCount: 1 })),
    total: totalRow?.n ?? 0,
  };
}

/** Brands with at least one live deal, for the feed's filter. */
export async function dealBrands(db: Db) {
  return db
    .selectDistinct({ slug: brands.slug, name: brands.name })
    .from(deals)
    .innerJoin(storeListings, eq(storeListings.id, deals.listingId))
    .innerJoin(variants, eq(variants.id, storeListings.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(isNull(deals.expiredAt))
    .orderBy(brands.name);
}
