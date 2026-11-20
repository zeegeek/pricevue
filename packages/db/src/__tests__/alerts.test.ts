import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq, sql } from "drizzle-orm";
import { runPriceAlerts, setEmailAlerts, unsubscribeToken, verifyUnsubscribeToken, type AlertEmail } from "../alerts";
import { createPgliteDb, runMigrations } from "../client";
import { getProductPage } from "../queries";
import { alertEvents, offers, storeListings, users } from "../schema";
import { seedDatabase } from "../seed/seed";
import { upsertWatchlistItem } from "../watchlist";

let handle: Awaited<ReturnType<typeof createPgliteDb>>;
let userId: string;
let variantId: number;
let cheapestOfferId: number;
let cheapest: number;
const sent: AlertEmail[] = [];
const t0 = new Date("2026-11-20T00:00:00Z");
const at = (hours: number) => new Date(t0.getTime() + hours * 3_600_000);
const run = (now: Date) =>
  runPriceAlerts(handle.db, { send: async (e) => void sent.push(e), siteUrl: "https://pv.test/", secret: "s", now });
const setPrice = async (paise: number) => {
  await handle.db.update(offers).set({ listedPaise: paise, shippingPaise: 0 }).where(eq(offers.id, cheapestOfferId));
  cheapest = paise;
};

beforeAll(async () => {
  handle = await createPgliteDb();
  await runMigrations(handle);
  await seedDatabase(handle.db, new Date("2026-11-19T12:00:00Z"));
  [{ id: userId }] = (await handle.db.insert(users).values({ email: "a@example.com" }).returning({ id: users.id })) as [
    { id: string },
  ];
  variantId = (await getProductPage(handle.db, "apple-iphone-15"))!.selected.id;
  const [row] = await handle.db
    .select({ id: offers.id, payable: sql<number>`(${offers.listedPaise} + ${offers.shippingPaise})::int` })
    .from(offers)
    .innerJoin(storeListings, eq(offers.listingId, storeListings.id))
    .where(and(eq(storeListings.variantId, variantId), eq(offers.isCurrent, true), eq(offers.inStock, true)))
    .orderBy(asc(sql`${offers.listedPaise} + ${offers.shippingPaise}`));
  cheapestOfferId = row!.id;
  cheapest = row!.payable;
}, 60_000);

afterAll(() => handle.close());

describe("price alerts", () => {
  it("alerts on target, dedupes, honours cooldown and re-alerts on further drops", async () => {
    const item = await upsertWatchlistItem(handle.db, userId, variantId, cheapest + 100_00);

    expect(await run(at(0))).toEqual({ checked: 1, sent: 1 });
    expect(sent[0]).toMatchObject({ to: "a@example.com", subject: expect.stringContaining("Price drop") });
    expect(sent[0]!.html).toContain(`https://pv.test/go/`);
    expect(sent[0]!.html).toContain(`/alerts/unsubscribe?item=${item.id}&amp;t=${unsubscribeToken(item.id, "s")}`);

    expect((await run(at(1))).sent).toBe(0); // same price, within cooldown
    await setPrice(cheapest - 100);
    expect((await run(at(2))).sent).toBe(1); // further drop bypasses cooldown
    expect((await run(at(30))).sent).toBe(0); // unchanged price after cooldown

    await setPrice(cheapest + 500_00); // rebound above target
    expect((await run(at(31))).sent).toBe(0);
    await setPrice(cheapest - 500_00 + 100); // back to just above the last alerted price
    expect((await run(at(32))).sent).toBe(1);

    const events = await handle.db.select().from(alertEvents).where(eq(alertEvents.watchlistItemId, item.id));
    expect(events.map((e) => e.reason)).toEqual(["target", "target", "target"]);
  });

  it("alerts on a meaningful drop without a target and stops after unsubscribe", async () => {
    const item = await upsertWatchlistItem(handle.db, userId, variantId, null);
    sent.length = 0;
    await handle.db.delete(alertEvents);
    expect((await run(at(40))).sent).toBe(0); // records baseline
    await setPrice(Math.round(cheapest * 0.98));
    expect((await run(at(41))).sent).toBe(0); // 2% isn't meaningful
    await setPrice(Math.round(cheapest * 0.9));
    expect((await run(at(42))).sent).toBe(1);
    expect(sent[0]!.text).toContain("was ");

    expect(verifyUnsubscribeToken(item.id, unsubscribeToken(item.id, "s"), "s")).toBe(true);
    expect(verifyUnsubscribeToken(item.id, "forged", "s")).toBe(false);
    await setEmailAlerts(handle.db, item.id, false);
    await setPrice(Math.round(cheapest * 0.5));
    expect(await run(at(43))).toEqual({ checked: 0, sent: 0 });
  });
});
