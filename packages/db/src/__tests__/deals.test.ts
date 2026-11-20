import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createPgliteDb, runMigrations } from "../client";
import { listDeals, runDealDetection } from "../deals";
import { getDeals, saveOfferSnapshot } from "../queries";
import { deals, pricePoints, storeListings } from "../schema";
import { seedDatabase } from "../seed/seed";

let handle: Awaited<ReturnType<typeof createPgliteDb>>;
let listingId: number;
let storeId: "amazon" | "flipkart";
const DAY = 86_400_000;
const now = new Date("2026-11-20T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY);

/** Replaces the listing's history with one price per day, oldest first, ending yesterday. */
async function setHistory(prices: number[]) {
  await handle.db.delete(pricePoints).where(eq(pricePoints.listingId, listingId));
  await handle.db.insert(pricePoints).values(
    prices.map((pricePaise, i) => ({ listingId, pricePaise, capturedAt: daysAgo(prices.length - i), inStock: true })),
  );
}
async function snapshot(listedPaise: number, at = now, mrpPaise?: number) {
  await saveOfferSnapshot(handle.db, listingId, {
    store: storeId,
    externalId: "x",
    listedPaise,
    shippingPaise: 0,
    mrpPaise,
    inStock: true,
    capturedAt: at,
    source: "fixture",
  });
  return runDealDetection(handle.db, { now: at, listingIds: [listingId] });
}
const dealRow = async () => (await handle.db.select().from(deals).where(eq(deals.listingId, listingId)))[0];

beforeAll(async () => {
  handle = await createPgliteDb();
  await runMigrations(handle);
  await seedDatabase(handle.db, now);
  const [l] = await handle.db.select().from(storeListings).limit(1);
  listingId = l!.id;
  storeId = l!.storeId as "amazon" | "flipkart";
}, 60_000);

afterAll(() => handle.close());

describe("deal detection", () => {
  it("builds the seeded feed from price history", async () => {
    expect((await getDeals(handle.db)).length).toBeGreaterThan(0);
  });

  it("ignores a fake MRP discount on a price that never moved", async () => {
    await setHistory(Array(60).fill(50_000_00));
    expect((await snapshot(50_000_00, now, 99_999_00)).active).toBe(0);
    const row = await dealRow();
    expect(row === undefined || row.expiredAt !== null).toBe(true);
  });

  it("flags a genuine drop versus the 30-day median as a lowest-ever deal", async () => {
    await setHistory(Array(60).fill(60_000_00));
    expect(await snapshot(51_000_00)).toEqual({ checked: 1, active: 1, expired: 0 });
    expect(await dealRow()).toMatchObject({
      pricePaise: 51_000_00,
      referencePaise: 60_000_00,
      dropPct: 15,
      isLowestEver: true,
      score: "great",
      expiredAt: null,
    });
    const { items } = await listDeals(handle.db, { store: storeId, minDropPct: 14 });
    expect(items.some((d) => d.pricePaise === 51_000_00 && d.isLowestEver)).toBe(true);
  });

  it("does not let a short pre-sale markup inflate the discount", async () => {
    await setHistory([...Array(80).fill(50_000_00), ...Array(10).fill(65_000_00)]);
    await snapshot(48_000_00);
    expect(await dealRow()).toMatchObject({ referencePaise: 50_000_00, dropPct: 4, score: "good" });
  });

  it("expires a deal when the price recovers and re-detects it later", async () => {
    await setHistory(Array(60).fill(60_000_00));
    await snapshot(51_000_00, daysAgo(0.5));
    const first = (await dealRow())!.detectedAt;

    expect((await snapshot(60_000_00)).expired).toBe(1);
    expect((await dealRow())!.expiredAt).toEqual(now);
    const { items } = await listDeals(handle.db, { store: storeId, minDropPct: 14 });
    expect(items.some((d) => d.pricePaise === 51_000_00)).toBe(false);

    const later = new Date(now.getTime() + DAY);
    await snapshot(50_000_00, later);
    expect(await dealRow()).toMatchObject({ expiredAt: null, detectedAt: later });
    expect(later.getTime()).toBeGreaterThan(first.getTime());
  });
});
