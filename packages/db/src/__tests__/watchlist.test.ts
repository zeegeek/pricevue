import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb, runMigrations } from "../client";
import { getProductPage } from "../queries";
import { users } from "../schema";
import { seedDatabase } from "../seed/seed";
import { getWatchlist, getWatchlistItem, removeWatchlistItem, upsertWatchlistItem } from "../watchlist";

let handle: Awaited<ReturnType<typeof createPgliteDb>>;
let userId: string;
let otherId: string;

beforeAll(async () => {
  handle = await createPgliteDb();
  await runMigrations(handle);
  await seedDatabase(handle.db, new Date("2026-11-19T12:00:00Z"));
  [{ id: userId }, { id: otherId }] = await handle.db
    .insert(users)
    .values([{ email: "a@example.com" }, { email: "b@example.com" }])
    .returning({ id: users.id }) as [{ id: string }, { id: string }];
}, 60_000);

afterAll(() => handle.close());

describe("watchlist", () => {
  it("adds, updates target, lists with best price and removes per user", async () => {
    const page = (await getProductPage(handle.db, "apple-iphone-15"))!;
    const variantId = page.selected.id;
    const cheapest = Math.min(...page.offers.filter((o) => o.inStock).map((o) => o.listedPaise + o.shippingPaise));

    await upsertWatchlistItem(handle.db, userId, variantId, null);
    await upsertWatchlistItem(handle.db, userId, variantId, 5_000_000);
    expect((await getWatchlistItem(handle.db, userId, variantId))?.targetPaise).toBe(5_000_000);

    const list = await getWatchlist(handle.db, userId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ slug: "apple-iphone-15", variantId, targetPaise: 5_000_000, bestPaise: cheapest });
    expect(await getWatchlist(handle.db, otherId)).toEqual([]);

    await removeWatchlistItem(handle.db, otherId, variantId);
    expect(await getWatchlist(handle.db, userId)).toHaveLength(1);
    await removeWatchlistItem(handle.db, userId, variantId);
    expect(await getWatchlist(handle.db, userId)).toEqual([]);
  });
});
