import { and, asc, desc, eq, gte, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { OfferSnapshot, StoreId } from "@pricevue/core";
import type { Db } from "./client";
import { brands, deals, offers, pricePoints, products, storeListings, variants } from "./schema";

export interface ProductCard {
  slug: string;
  title: string;
  brand: string;
  variantId: number;
  variantLabel: string;
  colourHex: string | null;
  storeId: StoreId;
  pricePaise: number;
  referencePaise: number | null;
  mrpPaise: number | null;
  dropPct: number | null;
  score: "great" | "good" | "fair" | null;
  storeCount: number;
}

const cardColumns = {
  slug: products.slug,
  title: products.title,
  brand: brands.name,
  variantId: variants.id,
  variantLabel: variants.label,
  colourHex: variants.colourHex,
  storeId: storeListings.storeId,
};

/** Biggest recent drops (one row per product). */
export async function getDeals(db: Db, limit = 8): Promise<ProductCard[]> {
  const rows = await db
    .select({
      ...cardColumns,
      pricePaise: deals.pricePaise,
      referencePaise: deals.referencePaise,
      mrpPaise: variants.launchMrpPaise,
      dropPct: deals.dropPct,
      score: deals.score,
    })
    .from(deals)
    .innerJoin(storeListings, eq(storeListings.id, deals.listingId))
    .innerJoin(variants, eq(variants.id, storeListings.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(isNull(deals.expiredAt))
    .orderBy(desc(deals.dropPct));
  const seen = new Set<string>();
  const out: ProductCard[] = [];
  for (const r of rows) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    out.push({ ...r, storeCount: 1 });
    if (out.length >= limit) break;
  }
  return out;
}

/** Best current in-stock price per product, filtered by an optional text query. */
export async function searchProducts(db: Db, query = "", limit = 24): Promise<ProductCard[]> {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const where = terms.length
    ? and(
        ...terms.map((t) =>
          or(ilike(products.title, `%${t}%`), ilike(variants.label, `%${t}%`), ilike(brands.name, `%${t}%`)),
        ),
      )
    : undefined;
  const rows = await db
    .select({
      ...cardColumns,
      pricePaise: offers.listedPaise,
      mrpPaise: offers.mrpPaise,
      productId: products.id,
    })
    .from(offers)
    .innerJoin(storeListings, eq(storeListings.id, offers.listingId))
    .innerJoin(variants, eq(variants.id, storeListings.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(and(eq(offers.isCurrent, true), eq(offers.inStock, true), where))
    .orderBy(asc(offers.listedPaise));
  const byProduct = new Map<string, ProductCard & { stores: Set<string> }>();
  for (const r of rows) {
    const existing = byProduct.get(r.slug);
    if (existing) {
      existing.stores.add(r.storeId);
      existing.storeCount = existing.stores.size;
      continue;
    }
    byProduct.set(r.slug, {
      ...r,
      referencePaise: null,
      dropPct: r.mrpPaise ? Math.round(((r.mrpPaise - r.pricePaise) / r.mrpPaise) * 100) : null,
      score: null,
      storeCount: 1,
      stores: new Set([r.storeId]),
    });
  }
  return [...byProduct.values()].slice(0, limit).map(({ stores: _stores, ...card }) => card);
}

export async function findByListing(db: Db, storeId: StoreId, externalId: string) {
  const [row] = await db
    .select({ slug: products.slug, variantId: variants.id })
    .from(storeListings)
    .innerJoin(variants, eq(variants.id, storeListings.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(eq(storeListings.storeId, storeId), eq(storeListings.externalId, externalId)));
  return row ?? null;
}

export async function getListing(db: Db, listingId: number) {
  const [row] = await db.select().from(storeListings).where(eq(storeListings.id, listingId));
  return row ?? null;
}

export async function getProductPage(db: Db, slug: string, variantId?: number) {
  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      title: products.title,
      modelName: products.modelName,
      brand: brands.name,
      specs: products.specs,
    })
    .from(products)
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(eq(products.slug, slug));
  if (!product) return null;

  const variantRows = await db
    .select()
    .from(variants)
    .where(eq(variants.productId, product.id))
    .orderBy(asc(variants.storageGb), asc(variants.id));
  const listingRows = await db
    .select({
      id: storeListings.id,
      variantId: storeListings.variantId,
      storeId: storeListings.storeId,
    })
    .from(storeListings)
    .where(
      inArray(
        storeListings.variantId,
        variantRows.map((v) => v.id),
      ),
    );
  const variantList = variantRows.map((v) => ({
    ...v,
    stores: listingRows.filter((l) => l.variantId === v.id).map((l) => l.storeId),
  }));
  const selected = variantList.find((v) => v.id === variantId) ?? variantList[0];
  if (!selected) return null;

  const offerRows = await db
    .select({
      listingId: storeListings.id,
      storeId: storeListings.storeId,
      url: storeListings.url,
      title: storeListings.title,
      lastCheckedAt: storeListings.lastCheckedAt,
      matchConfidence: storeListings.matchConfidence,
      seller: offers.seller,
      listedPaise: offers.listedPaise,
      shippingPaise: offers.shippingPaise,
      mrpPaise: offers.mrpPaise,
      inStock: offers.inStock,
      stockLabel: offers.stockLabel,
      warranty: offers.warranty,
      bankOffer: offers.bankOffer,
      couponOffer: offers.couponOffer,
    })
    .from(storeListings)
    .innerJoin(offers, and(eq(offers.listingId, storeListings.id), eq(offers.isCurrent, true)))
    .where(eq(storeListings.variantId, selected.id));

  const historyRows = offerRows.length
    ? await db
        .select({
          listingId: pricePoints.listingId,
          at: pricePoints.capturedAt,
          pricePaise: pricePoints.pricePaise,
        })
        .from(pricePoints)
        .where(
          inArray(
            pricePoints.listingId,
            offerRows.map((o) => o.listingId),
          ),
        )
        .orderBy(asc(pricePoints.capturedAt))
    : [];
  const history: Partial<Record<StoreId, { at: string; pricePaise: number }[]>> = {};
  for (const o of offerRows) {
    history[o.storeId] = historyRows
      .filter((h) => h.listingId === o.listingId)
      .map((h) => ({ at: h.at.toISOString(), pricePaise: h.pricePaise }));
  }

  return { product, variants: variantList, selected, offers: offerRows, history };
}

export async function getSimilarProducts(db: Db, slug: string, limit = 4): Promise<ProductCard[]> {
  const all = await searchProducts(db, "", 50);
  return all.filter((p) => p.slug !== slug).slice(0, limit);
}

export async function countTracked(db: Db) {
  const [row] = await db
    .select({
      listings: sql<number>`count(distinct ${storeListings.id})::int`,
      points: sql<number>`(select count(*)::int from ${pricePoints})`,
    })
    .from(storeListings)
    .where(ne(storeListings.id, 0));
  return row ?? { listings: 0, points: 0 };
}

export async function recentPricePoints(db: Db, listingId: number, since: Date) {
  return db
    .select()
    .from(pricePoints)
    .where(and(eq(pricePoints.listingId, listingId), gte(pricePoints.capturedAt, since)))
    .orderBy(asc(pricePoints.capturedAt));
}

/** Marks the listing's previous offer stale, writes the new current offer and a price-history point. */
export async function saveOfferSnapshot(db: Db, listingId: number, offer: OfferSnapshot) {
  await db.transaction(async (tx) => {
    await tx
      .update(offers)
      .set({ isCurrent: false })
      .where(and(eq(offers.listingId, listingId), eq(offers.isCurrent, true)));
    await tx.insert(offers).values({
      listingId,
      seller: offer.seller,
      listedPaise: offer.listedPaise,
      shippingPaise: offer.shippingPaise,
      mrpPaise: offer.mrpPaise,
      inStock: offer.inStock,
      capturedAt: offer.capturedAt,
    });
    await tx.insert(pricePoints).values({
      listingId,
      capturedAt: offer.capturedAt,
      pricePaise: offer.listedPaise,
      inStock: offer.inStock,
    });
    await tx.update(storeListings).set({ lastCheckedAt: offer.capturedAt }).where(eq(storeListings.id, listingId));
  });
}

export async function findListingId(db: Db, storeId: StoreId, externalId: string) {
  const [row] = await db
    .select({ id: storeListings.id })
    .from(storeListings)
    .where(and(eq(storeListings.storeId, storeId), eq(storeListings.externalId, externalId)));
  return row?.id ?? null;
}

export async function listProductSlugs(db: Db) {
  return db.select({ slug: products.slug, createdAt: products.createdAt }).from(products);
}
