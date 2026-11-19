import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb, runMigrations } from "../client";
import {
  findByListing,
  findListingId,
  getDeals,
  getProductPage,
  recentPricePoints,
  saveOfferSnapshot,
  searchProducts,
} from "../queries";
import { seedDatabase } from "../seed/seed";

let handle: Awaited<ReturnType<typeof createPgliteDb>>;

beforeAll(async () => {
  handle = await createPgliteDb();
  await runMigrations(handle);
  await seedDatabase(handle.db, new Date("2026-11-19T12:00:00Z"));
}, 60_000);

afterAll(() => handle.close());

describe("db seed + queries", () => {
  it("searches products by name with variant-aware cards", async () => {
    const results = await searchProducts(handle.db, "iphone 15");
    expect(results.map((r) => r.slug)).toEqual(["apple-iphone-15"]);
    expect(results[0]!.storeCount).toBe(2);
  });

  it("builds a product page with per-store offers and a year of history", async () => {
    const page = await getProductPage(handle.db, "apple-iphone-15");
    expect(page?.offers.map((o) => o.storeId).sort()).toEqual(["amazon", "flipkart"]);
    expect(page?.history.amazon?.length).toBeGreaterThan(300);
    expect(page?.variants.find((v) => v.storageGb === 512)?.stores).toEqual(["amazon"]);
  });

  it("finds a product from a store listing id and returns deals", async () => {
    const page = await getProductPage(handle.db, "oneplus-13r");
    const listing = page!.offers[0]!;
    const externalId = listing.url
      .match(/dp\/(\w+)|pid=(\w+)/)!
      .slice(1)
      .find(Boolean)!;
    expect(await findByListing(handle.db, listing.storeId, externalId)).toEqual({
      slug: "oneplus-13r",
      variantId: page!.selected.id,
    });
    expect((await getDeals(handle.db)).length).toBeGreaterThan(0);
  });

  it("saves a refresh snapshot as the current offer plus a price point", async () => {
    const before = await getProductPage(handle.db, "apple-iphone-15");
    const externalId = new URL(before!.offers.find((o) => o.storeId === "flipkart")!.url).searchParams.get("pid")!;
    const listingId = (await findListingId(handle.db, "flipkart", externalId))!;
    expect(listingId).toBeTypeOf("number");
    const capturedAt = new Date("2026-11-20T00:00:00Z");
    await saveOfferSnapshot(handle.db, listingId, {
      store: "flipkart",
      externalId,
      listedPaise: 5_899_900,
      shippingPaise: 0,
      mrpPaise: 6_990_000,
      inStock: true,
      capturedAt,
      source: "scraper",
    });
    const page = await getProductPage(handle.db, "apple-iphone-15");
    expect(page?.offers.find((o) => o.storeId === "flipkart")).toMatchObject({
      listedPaise: 5_899_900,
    });
    const points = await recentPricePoints(handle.db, listingId, capturedAt);
    expect(points.at(-1)).toMatchObject({ pricePaise: 5_899_900 });
  });
});
