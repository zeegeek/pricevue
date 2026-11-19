import { and, eq } from "drizzle-orm";
import {
  REVIEW_THRESHOLD,
  SAME_PRODUCT_THRESHOLD,
  canonicalColour,
  extractAttributes,
  matchProducts,
  modelSimilarity,
  type ListingDetails,
  type MatchResult,
  type ProductAttributes,
} from "@pricevue/core";
import type { Db } from "./client";
import { brands, categories, pendingMatches, products, storeListings, variants } from "./schema";

export type IngestOutcome = "existing" | "linked" | "created";

export interface IngestResult {
  listingId: number;
  variantId: number;
  outcome: IngestOutcome;
  match: (MatchResult & { variantId: number }) | null;
  /** Set when a plausible candidate was queued for review instead of being linked. */
  pendingVariantId?: number;
}

const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const titleCase = (v: string) => v.replace(/\b\w/g, (c) => c.toUpperCase());

async function bestCandidate(db: Db, attrs: ProductAttributes) {
  const rows = await db
    .select({
      variantId: variants.id,
      productId: products.id,
      brand: brands.slug,
      modelName: products.modelName,
      storageGb: variants.storageGb,
      ramGb: variants.ramGb,
      colour: variants.colour,
      gtin: variants.gtin,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .innerJoin(brands, eq(brands.id, products.brandId))
    .where(attrs.brand ? eq(brands.slug, attrs.brand) : undefined);
  let best: (MatchResult & { variantId: number }) | null = null;
  let sameModelProductId: number | null = null;
  for (const r of rows) {
    const head = extractAttributes(`${r.brand} ${r.modelName}`);
    const candidate: ProductAttributes = {
      brand: head.brand ?? r.brand,
      model: head.model,
      storageGb: r.storageGb,
      ramGb: r.ramGb,
      colour: canonicalColour(r.colour),
      gtin: r.gtin,
    };
    if (attrs.model && candidate.model && modelSimilarity(attrs.model, candidate.model) === 1) {
      sameModelProductId = r.productId;
    }
    const m = matchProducts(attrs, candidate);
    if (!best || m.confidence > best.confidence) best = { ...m, variantId: r.variantId };
  }
  return { best, sameModelProductId };
}

/**
 * Attaches a newly seen store listing to the variant it matches. High-confidence matches are
 * linked; otherwise a new product/variant is created and any plausible candidate is queued in
 * `pending_matches` for review rather than guessed.
 */
export async function ingestListing(db: Db, listing: ListingDetails): Promise<IngestResult> {
  const [existing] = await db
    .select({ id: storeListings.id, variantId: storeListings.variantId })
    .from(storeListings)
    .where(and(eq(storeListings.storeId, listing.store), eq(storeListings.externalId, listing.externalId)));
  if (existing) return { listingId: existing.id, variantId: existing.variantId, outcome: "existing", match: null };

  const attrs = extractAttributes(listing.title, listing);
  const { best, sameModelProductId } = await bestCandidate(db, attrs);

  return db.transaction(async (tx) => {
    const insertListing = async (variantId: number, confidence: number, method: string) => {
      const [row] = await tx
        .insert(storeListings)
        .values({
          variantId,
          storeId: listing.store,
          externalId: listing.externalId,
          url: listing.url,
          title: listing.title,
          matchConfidence: confidence,
          matchMethod: method,
        })
        .returning({ id: storeListings.id });
      return row!.id;
    };

    if (best && best.confidence >= SAME_PRODUCT_THRESHOLD) {
      const listingId = await insertListing(best.variantId, best.confidence, best.reasons[0] === "gtin" ? "gtin" : "auto");
      if (attrs.gtin) await tx.update(variants).set({ gtin: attrs.gtin }).where(eq(variants.id, best.variantId));
      return { listingId, variantId: best.variantId, outcome: "linked" as const, match: best };
    }

    const brandSlug = attrs.brand ?? "unknown";
    const modelName = titleCase(attrs.model ?? listing.title);
    const productSlug = slugify(`${brandSlug} ${modelName}`);
    let [product] = sameModelProductId
      ? [{ id: sameModelProductId }]
      : await tx.select({ id: products.id }).from(products).where(eq(products.slug, productSlug));
    if (!product) {
      const [brand] = await tx
        .insert(brands)
        .values({ slug: brandSlug, name: titleCase(brandSlug) })
        .onConflictDoUpdate({ target: brands.slug, set: { slug: brandSlug } })
        .returning({ id: brands.id });
      const [category] = await tx
        .insert(categories)
        .values({ slug: "smartphones", name: "Smartphones" })
        .onConflictDoUpdate({ target: categories.slug, set: { slug: "smartphones" } })
        .returning({ id: categories.id });
      [product] = await tx
        .insert(products)
        .values({
          slug: productSlug,
          title: `${titleCase(brandSlug)} ${modelName}`,
          brandId: brand!.id,
          categoryId: category!.id,
          modelName,
        })
        .returning({ id: products.id });
    }

    const parts = [attrs.ramGb && `${attrs.ramGb}GB`, attrs.storageGb && `${attrs.storageGb}GB`, attrs.colour && titleCase(attrs.colour)];
    const [variant] = await tx
      .insert(variants)
      .values({
        productId: product!.id,
        sku: `${productSlug}-${attrs.ramGb ?? "x"}-${attrs.storageGb ?? "x"}-${slugify(attrs.colour ?? "x")}-${listing.store}-${listing.externalId}`.toLowerCase(),
        label: parts.filter(Boolean).join(" · ") || "Default",
        storageGb: attrs.storageGb,
        ramGb: attrs.ramGb,
        colour: attrs.colour && titleCase(attrs.colour),
        gtin: attrs.gtin,
      })
      .returning({ id: variants.id });
    const listingId = await insertListing(variant!.id, 1, "new");

    if (best && best.confidence >= REVIEW_THRESHOLD) {
      await tx.insert(pendingMatches).values({
        listingId,
        candidateVariantId: best.variantId,
        confidence: best.confidence,
        reasons: best.reasons,
      });
      return { listingId, variantId: variant!.id, outcome: "created" as const, match: best, pendingVariantId: best.variantId };
    }
    return { listingId, variantId: variant!.id, outcome: "created" as const, match: best };
  });
}
