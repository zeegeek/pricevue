import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgliteDb, runMigrations } from "../client";
import { ingestListing, queuePendingMatch } from "../matching";
import { approvePendingMatch, listPendingMatches, rejectPendingMatch } from "../review";
import { pendingMatches, storeListings, users, variants } from "../schema";
import { seedDatabase } from "../seed/seed";

let handle: Awaited<ReturnType<typeof createPgliteDb>>;
let adminId: string;

beforeAll(async () => {
  handle = await createPgliteDb();
  await runMigrations(handle);
  await seedDatabase(handle.db, new Date("2026-11-19T12:00:00Z"));
  [{ id: adminId }] = (await handle.db.insert(users).values({ email: "admin@example.test" }).returning({ id: users.id })) as [{ id: string }];
}, 60_000);

afterAll(() => handle.close());

const queue = async (externalId: string) => {
  const r = await ingestListing(handle.db, {
    store: "amazon",
    externalId,
    title: "Apple iPhone 16 (128 GB)",
    url: `https://example.test/${externalId}`,
    imageUrl: "https://example.test/i.jpg",
  });
  const [p] = await handle.db.select().from(pendingMatches).where(eq(pendingMatches.listingId, r.listingId));
  return { ...r, pending: p! };
};

describe("match review", () => {
  it("lists pending matches with both sides, highest score first", async () => {
    const { pending } = await queue("B0REVIEW01");
    const { items, total } = await listPendingMatches(handle.db);
    expect(total).toBeGreaterThan(0);
    const item = items.find((i) => i.id === pending.id)!;
    expect(item.listing).toMatchObject({ store: "amazon", imageUrl: "https://example.test/i.jpg", attrs: { storageGb: 128 } });
    expect(item.candidate.variantId).toBe(pending.candidateVariantId);
    expect(items.map((i) => i.confidence)).toEqual([...items.map((i) => i.confidence)].sort((a, b) => b - a));
  });

  it("approve links the listing to the candidate and removes the placeholder variant", async () => {
    const { pending, listingId, variantId: placeholder } = await queue("B0REVIEW02");
    expect(await approvePendingMatch(handle.db, pending.id, adminId)).toBe(true);
    const [l] = await handle.db.select().from(storeListings).where(eq(storeListings.id, listingId));
    expect(l).toMatchObject({ variantId: pending.candidateVariantId, matchMethod: "manual" });
    const [row] = await handle.db.select().from(pendingMatches).where(eq(pendingMatches.id, pending.id));
    expect(row).toMatchObject({ status: "approved", resolvedBy: adminId });
    expect(row!.resolvedAt).toBeInstanceOf(Date);
    expect(await handle.db.select().from(variants).where(eq(variants.id, placeholder))).toHaveLength(0);
    expect(await approvePendingMatch(handle.db, pending.id, adminId)).toBe(false);
  });

  it("reject records the resolver and the pair is never re-queued", async () => {
    const { pending, listingId, variantId, match } = await queue("B0REVIEW03");
    expect(await rejectPendingMatch(handle.db, pending.id, adminId)).toBe(true);
    const [row] = await handle.db.select().from(pendingMatches).where(eq(pendingMatches.id, pending.id));
    expect(row).toMatchObject({ status: "rejected", resolvedBy: adminId });
    const [l] = await handle.db.select().from(storeListings).where(eq(storeListings.id, listingId));
    expect(l!.variantId).toBe(variantId);

    const again = await ingestListing(handle.db, {
      store: "amazon",
      externalId: "B0REVIEW03",
      title: "Apple iPhone 16 (128 GB)",
      url: "https://example.test/B0REVIEW03",
    });
    expect(again.outcome).toBe("existing");
    expect(await queuePendingMatch(handle.db, listingId, match!)).toBe(false);
    const rows = await handle.db.select().from(pendingMatches).where(eq(pendingMatches.listingId, listingId));
    expect(rows).toEqual([expect.objectContaining({ status: "rejected" })]);
    expect((await listPendingMatches(handle.db)).items.some((i) => i.id === pending.id)).toBe(false);
  });
});
