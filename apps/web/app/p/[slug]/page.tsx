import { bestPriceSeries, buyOrWait, formatINR, priceStats, rankOffers, STORES, type StoreId } from "@pricevue/core";
import { getProductPage, getSimilarProducts } from "@pricevue/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertPanel } from "@/components/alert-panel";
import { BuyMeter } from "@/components/buy-meter";
import { ComparisonTable } from "@/components/comparison-table";
import { PhoneArt } from "@/components/phone-art";
import { PriceChart } from "@/components/price-chart";
import { ProductCard } from "@/components/product-card";
import { VariantSelector } from "@/components/variant-selector";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getProductPage(await db(), (await params).slug);
  return { title: page ? `${page.product.title} price history & comparison` : "Product" };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ slug }, { v }] = await Promise.all([params, searchParams]);
  const database = await db();
  const page = await getProductPage(database, slug, v ? Number(v) : undefined);
  if (!page) notFound();
  const similar = await getSimilarProducts(database, slug);

  const now = Date.now();
  const best = rankOffers(page.offers)[0];
  const series = bestPriceSeries(page.history as Record<StoreId, { at: string; pricePaise: number }[]>);
  const stats = priceStats(series);
  const verdict = best ? buyOrWait(best.payablePaise, series) : null;
  const lastChecked = page.offers.reduce<Date | null>(
    (a, o) => (o.lastCheckedAt && (!a || o.lastCheckedAt > a) ? o.lastCheckedAt : a),
    null,
  );

  return (
    <div className="container py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link> /{" "}
        <Link href="/search?q=" className="hover:text-foreground">Smartphones</Link> /{" "}
        <span className="text-foreground">{page.product.title}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="relative grid place-items-center rounded-3xl border border-border bg-card p-10 shadow-soft">
          <div className="absolute inset-10 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
          <PhoneArt colour={page.selected.colourHex} className="relative h-72 w-44" />
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">{page.product.brand}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{page.product.title}</h1>
          <p className="mt-1 text-muted-foreground">{page.selected.label}</p>
          {best && (
            <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="tabular font-display text-4xl font-extrabold">{formatINR(best.payablePaise)}</p>
              <p className="pb-1 text-sm text-muted-foreground">
                best on <span className="font-semibold text-foreground">{STORES[best.offer.storeId].name}</span>
                {stats && stats.lowest < best.payablePaise && <> · all-time low {formatINR(stats.lowest)}</>}
              </p>
            </div>
          )}
          {lastChecked && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="mr-1 inline-block size-2 animate-pulse rounded-full bg-emerald-500" aria-hidden />
              Prices last checked{" "}
              {lastChecked.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} IST
            </p>
          )}
          <div className="mt-6">
            <VariantSelector slug={slug} variants={page.variants} selected={page.selected} />
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <ComparisonTable offers={page.offers} now={now} />
          <section aria-labelledby="hist" className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 id="hist" className="mb-4 font-display text-lg font-bold">Price history</h2>
            <PriceChart history={page.history} />
          </section>
          <section aria-labelledby="specs" className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 id="specs" className="font-display text-lg font-bold">Key specs</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {Object.entries(page.product.specs).map(([k, val]) => (
                <div key={k} className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{val}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
        <aside className="space-y-6">
          {verdict && <BuyMeter result={verdict} />}
          {best && stats && <AlertPanel currentPaise={best.payablePaise} lowestPaise={stats.lowest} />}
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar" className="mt-16">
          <h2 id="similar" className="font-display text-2xl font-extrabold">Similar phones</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {similar.map((c) => (
              <ProductCard key={c.slug} card={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
