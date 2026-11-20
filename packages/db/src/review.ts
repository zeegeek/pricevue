import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { extractAttributes, type StoreId } from "@pricevue/core";
import type { Db } from "./client";
import { brands, offers, pendingMatches, products, storeListings, variants } from "./schema";

export interface MatchSide {
  title: string;
  store: StoreId | null;
  url: string | null;
  imageUrl: string | null;
  pricePaise: number | null;
  attrs: { brand: string | null; model: string | null; storageGb: number | null; ramGb: number | null; colour: string | null };
}

export interface PendingMatchItem {
  id: number;
  confidence: number;
  reasons: string[];
  createdAt: Date;
  listing: MatchSide;
  candidate: MatchSide & { variantId: number; productSlug: string; variantLabel: string };
}

const currentPrice = sql<number | null>`(select min(${offers.listedPaise}) from ${offers} where ${offers.listingId} = ${storeListings.id} and ${offers.isCurrent})`;

/** Pending (unresolved) matches, highest score first, with both sides resolved for side-by-side review. */
export async function listPendingMatches(db: Db, { page = 1, pageSize = 20 } = {}) {
  const where = eq(pendingMatches.status, "pending");
  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    db
      .select({
        id: pendingMatches.id,
        confidence: pendingMatches.confidence,
        reasons: pendingMatches.reasons,
        createdAt: pendingMatches.createdAt,
        listingId: pendingMatches.listingId,
        variantId: pendingMatches.candidateVariantId,
      })
      .from(pendingMatches)
      .where(where)
      .orderBy(desc(pendingMatches.confidence), asc(pendingMatches.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(pendingMatches).where(where),
  ]);

  const listingCols = {
    title: storeListings.title,
    store: storeListings.storeId,
    url: storeListings.url,
    imageUrl: storeListings.imageUrl,
    pricePaise: currentPrice,
  };
  const items: PendingMatchItem[] = await Promise.all(
    rows.map(async (r) => {
      const [[l], [v], [cl]] = await Promise.all([
        db.select(listingCols).from(storeListings).where(eq(storeListings.id, r.listingId)),
        db
          .select({
            productTitle: products.title,
            productSlug: products.slug,
            modelName: products.modelName,
            brand: brands.name,
            label: variants.label,
            storageGb: variants.storageGb,
            ramGb: variants.ramGb,
            colour: variants.colour,
          })
          .from(variants)
          .innerJoin(products, eq(products.id, variants.productId))
          .innerJoin(brands, eq(brands.id, products.brandId))
          .where(eq(variants.id, r.variantId)),
        db
          .select(listingCols)
          .from(storeListings)
          .where(eq(storeListings.variantId, r.variantId))
          .orderBy(sql`${currentPrice} asc nulls last`)
          .limit(1),
      ]);
      const a = extractAttributes(l!.title);
      return {
        id: r.id,
        confidence: r.confidence,
        reasons: r.reasons,
        createdAt: r.createdAt,
        listing: {
          ...l!,
          attrs: { brand: a.brand ?? null, model: a.model ?? null, storageGb: a.storageGb ?? null, ramGb: a.ramGb ?? null, colour: a.colour ?? null },
        },
        candidate: {
          variantId: r.variantId,
          productSlug: v!.productSlug,
          variantLabel: v!.label,
          title: `${v!.productTitle} (${v!.label})`,
          store: cl?.store ?? null,
          url: cl?.url ?? null,
          imageUrl: cl?.imageUrl ?? null,
          pricePaise: cl?.pricePaise ?? null,
          attrs: { brand: v!.brand, model: v!.modelName, storageGb: v!.storageGb, ramGb: v!.ramGb, colour: v!.colour },
        },
      };
    }),
  );
  return { items, total };
}

/** Claims a still-pending row, recording who resolved it and when. */
async function resolve(tx: Pick<Db, "update">, id: number, status: "approved" | "rejected", userId: string | null) {
  const [row] = await tx
    .update(pendingMatches)
    .set({ status, resolvedBy: userId, resolvedAt: new Date() })
    .where(and(eq(pendingMatches.id, id), eq(pendingMatches.status, "pending")))
    .returning({ listingId: pendingMatches.listingId, variantId: pendingMatches.candidateVariantId });
  return row ?? null;
}

/**
 * Links the listing to the candidate variant. The placeholder variant/product created at ingest is
 * removed once nothing else lists it; other open candidates for the same listing are rejected.
 */
export async function approvePendingMatch(db: Db, id: number, userId: string | null) {
  return db.transaction(async (tx) => {
    const row = await resolve(tx, id, "approved", userId);
    if (!row) return false;
    const [listing] = await tx.select({ variantId: storeListings.variantId }).from(storeListings).where(eq(storeListings.id, row.listingId));
    await tx
      .update(storeListings)
      .set({ variantId: row.variantId, matchConfidence: 1, matchMethod: "manual" })
      .where(eq(storeListings.id, row.listingId));
    await tx
      .update(pendingMatches)
      .set({ status: "rejected", resolvedBy: userId, resolvedAt: new Date() })
      .where(and(eq(pendingMatches.listingId, row.listingId), eq(pendingMatches.status, "pending"), ne(pendingMatches.id, id)));

    const oldVariantId = listing?.variantId;
    if (oldVariantId && oldVariantId !== row.variantId) {
      const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(storeListings).where(eq(storeListings.variantId, oldVariantId));
      if (n === 0) {
        const [old] = await tx.delete(variants).where(eq(variants.id, oldVariantId)).returning({ productId: variants.productId });
        const [{ left } = { left: 0 }] = await tx.select({ left: count() }).from(variants).where(eq(variants.productId, old!.productId));
        if (left === 0) await tx.delete(products).where(eq(products.id, old!.productId));
      }
    }
    return true;
  });
}

/** Marks the pair rejected; the listing keeps its own variant and the pair is never re-queued. */
export async function rejectPendingMatch(db: Db, id: number, userId: string | null) {
  return (await resolve(db, id, "rejected", userId)) !== null;
}
