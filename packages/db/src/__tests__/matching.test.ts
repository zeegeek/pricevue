import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ListingDetails } from "@pricevue/core";
import { createPgliteDb, runMigrations } from "../client";
import { ingestListing } from "../matching";
import { pendingMatches, variants } from "../schema";
import { seedDatabase } from "../seed/seed";

let handle: Awaited<ReturnType<typeof createPgliteDb>>;

beforeAll(async () => {
  handle = await createPgliteDb();
  await runMigrations(handle);
  await seedDatabase(handle.db, new Date("2026-11-19T12:00:00Z"));
}, 60_000);

afterAll(() => handle.close());

const listing = (store: "amazon" | "flipkart", externalId: string, title: string, extra: Partial<ListingDetails> = {}) =>
  ({ store, externalId, title, url: `https://example.test/${externalId}`, ...extra }) satisfies ListingDetails;

describe("ingestListing", () => {
  it("links a new store listing to the exact existing variant", async () => {
    const r = await ingestListing(handle.db, listing("amazon", "B0TEST0001", "Apple iPhone 15 (256 GB) - Blue"));
    expect(r.outcome).toBe("linked");
    const [v] = await handle.db.select().from(variants).where(eq(variants.id, r.variantId));
    expect(v).toMatchObject({ storageGb: 256, colour: "Blue" });
    expect((await ingestListing(handle.db, listing("amazon", "B0TEST0001", "ignored"))).outcome).toBe("existing");
  });

  it("creates a new variant under the same product when storage differs (never 128 ↔ 256)", async () => {
    const r = await ingestListing(handle.db, listing("flipkart", "MOBTEST0002", "Apple iPhone 15 (Black, 1 TB)"));
    expect(r.outcome).toBe("created");
    expect(r.pendingVariantId).toBeUndefined();
    const [v] = await handle.db.select().from(variants).where(eq(variants.id, r.variantId));
    expect(v).toMatchObject({ storageGb: 1024, colour: "Black" });
    const [seeded] = await handle.db.select().from(variants).where(eq(variants.storageGb, 128)).limit(1);
    expect(v!.productId).toBe(seeded!.productId);
  });

  it("queues an under-specified listing for review instead of guessing", async () => {
    const r = await ingestListing(handle.db, listing("amazon", "B0TEST0003", "Apple iPhone 16 (128 GB)"));
    expect(r.outcome).toBe("created");
    expect(r.pendingVariantId).toBeTypeOf("number");
    const [pending] = await handle.db.select().from(pendingMatches).where(eq(pendingMatches.listingId, r.listingId));
    expect(pending).toMatchObject({ candidateVariantId: r.pendingVariantId, status: "pending" });
    expect(pending!.confidence).toBeLessThan(0.9);
  });

  it("links on a shared GTIN", async () => {
    const a = await ingestListing(
      handle.db,
      listing("flipkart", "MOBTEST0004", "Samsung Galaxy Z Flip6 (Silver Shadow, 256 GB) (12 GB RAM)", { gtin: "8806095467894" }),
    );
    const b = await ingestListing(handle.db, listing("amazon", "B0TEST0004", "Samsung Galaxy Z Flip6", { gtin: "8806095467894" }));
    expect(b).toMatchObject({ outcome: "linked", variantId: a.variantId });
  });
});
