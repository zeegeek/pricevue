import { sql } from "drizzle-orm";
import { rupeesToPaise } from "@pricevue/core";
import type { Db } from "../client";
import * as s from "../schema";
import { SALE_WINDOWS, SEED_BRANDS, SEED_PRODUCTS } from "./data";

const DAY_MS = 86_400_000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Daily price series (rupees) ending today at roughly `price`. */
export function generateSeries(mrp: number, price: number, days: number, seed: number): number[] {
  const rand = rng(seed);
  const out: number[] = [];
  let level = mrp * 0.97;
  for (let d = days; d >= 0; d--) {
    const target = price + (mrp * 0.97 - price) * (d / days);
    if (rand() < 0.08) level = target * (1 + (rand() - 0.5) * 0.04);
    let p = level;
    for (const [from, to, factor] of SALE_WINDOWS) if (d <= from && d >= to) p = Math.min(p, target * factor);
    if (d === 0) p = price;
    out.push(Math.round(p / 100) * 100 - 1);
  }
  return out;
}

export async function seedDatabase(db: Db, now = new Date()): Promise<{ products: number; pricePoints: number }> {
  await db.execute(
    sql`TRUNCATE deals, alerts, watchlists, users, price_points, offers, store_listings, variants, products, brands, categories, stores RESTART IDENTITY CASCADE`,
  );
  await db.insert(s.stores).values([
    { id: "amazon", name: "Amazon.in", domain: "amazon.in", isLive: true },
    { id: "flipkart", name: "Flipkart", domain: "flipkart.com", isLive: true },
    { id: "myntra", name: "Myntra", domain: "myntra.com" },
    { id: "ajio", name: "Ajio", domain: "ajio.com" },
    { id: "croma", name: "Croma", domain: "croma.com" },
  ]);
  const [category] = await db.insert(s.categories).values({ slug: "smartphones", name: "Smartphones" }).returning();
  const brandRows = await db.insert(s.brands).values(SEED_BRANDS.map((name) => ({ name, slug: slugify(name) }))).returning();
  const brandId = new Map(brandRows.map((b) => [b.name, b.id]));

  let pointCount = 0;
  let seed = 1;
  for (const p of SEED_PRODUCTS) {
    const [product] = await db
      .insert(s.products)
      .values({
        slug: p.slug,
        title: `${p.brand} ${p.modelName}`,
        brandId: brandId.get(p.brand)!,
        categoryId: category!.id,
        modelName: p.modelName,
        launchMrpPaise: rupeesToPaise(Math.min(...p.variants.map((v) => v.mrp))),
        specs: p.specs,
      })
      .returning();
    for (const v of p.variants) {
      const label = `${v.ramGb} GB + ${v.storageGb} GB · ${v.colour}`;
      const [variant] = await db
        .insert(s.variants)
        .values({
          productId: product!.id,
          sku: `${p.slug}-${v.ramGb}-${v.storageGb}-${slugify(v.colour)}`,
          label,
          storageGb: v.storageGb,
          ramGb: v.ramGb,
          colour: v.colour,
          colourHex: v.colourHex,
          launchMrpPaise: rupeesToPaise(v.mrp),
        })
        .returning();
      for (const storeId of v.stores) {
        seed++;
        const externalId =
          storeId === "amazon"
            ? `B0${String(seed * 7919).padStart(8, "0")}`.slice(0, 10)
            : `MOB${slugify(p.modelName).replace(/-/g, "").toUpperCase().padEnd(9, "X").slice(0, 9)}${String(seed).padStart(4, "0")}`;
        const url =
          storeId === "amazon"
            ? `https://www.amazon.in/dp/${externalId}`
            : `https://www.flipkart.com/${p.slug}/p/itm${String(seed).padStart(10, "0")}?pid=${externalId}`;
        const title = `${p.brand} ${p.modelName} (${v.colour}, ${v.storageGb} GB) (${v.ramGb} GB RAM)`;
        const storeOffset = storeId === "flipkart" ? (seed % 3) * 500 - 500 : 0;
        const price = v.price + storeOffset;
        const days = Math.min(365, p.launchedDaysAgo);
        const series = generateSeries(v.mrp, price, days, seed * 31);
        const lastCheckedAt = new Date(now.getTime() - ((seed * 7) % 50) * 60_000);
        const [listing] = await db
          .insert(s.storeListings)
          .values({ variantId: variant!.id, storeId, externalId, url, title, matchConfidence: 0.97, matchMethod: "attributes", lastCheckedAt })
          .returning();
        const points = series.map((rupees, i) => ({
          listingId: listing!.id,
          capturedAt: new Date(now.getTime() - (days - i) * DAY_MS),
          pricePaise: rupeesToPaise(rupees),
          inStock: true,
        }));
        for (let i = 0; i < points.length; i += 500) await db.insert(s.pricePoints).values(points.slice(i, i + 500));
        pointCount += points.length;

        const current = series.at(-1)!;
        const inStock = !(p.slug === "oneplus-13r" && storeId === "amazon" && v.storageGb === 512);
        await db.insert(s.offers).values({
          listingId: listing!.id,
          seller: storeId === "amazon" ? "Appario Retail" : "RetailNet",
          listedPaise: rupeesToPaise(current),
          shippingPaise: 0,
          mrpPaise: rupeesToPaise(v.mrp),
          inStock,
          stockLabel: inStock ? "In stock" : "Out of stock",
          warranty: "1 year manufacturer",
          bankOffer: storeId === "amazon" ? "₹1,500 off with HDFC cards" : "5% cashback with Flipkart Axis",
          couponOffer: seed % 4 === 0 ? "Extra ₹500 coupon" : null,
          capturedAt: lastCheckedAt,
        });

        const ref = series[Math.max(0, series.length - 31)]!;
        const dropPct = ((ref - current) / ref) * 100;
        if (dropPct >= 2) {
          await db.insert(s.deals).values({
            listingId: listing!.id,
            pricePaise: rupeesToPaise(current),
            referencePaise: rupeesToPaise(ref),
            dropPct: Math.round(dropPct * 10) / 10,
            score: dropPct >= 8 ? "great" : dropPct >= 4 ? "good" : "fair",
            detectedAt: new Date(now.getTime() - (seed % 12) * 3_600_000),
          });
        }
      }
    }
  }
  await db.insert(s.users).values({ email: "demo@pricevue.in", name: "Demo User" });
  return { products: SEED_PRODUCTS.length, pricePoints: pointCount };
}
