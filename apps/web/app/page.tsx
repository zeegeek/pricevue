import { formatINR } from "@pricevue/core";
import { getDeals, searchProducts } from "@pricevue/db";
import { Bell, LineChart, Link2, Scale } from "lucide-react";
import Link from "next/link";
import { OmniSearch } from "@/components/omni-search";
import { PhoneArt } from "@/components/phone-art";
import { ProductCard } from "@/components/product-card";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const steps = [
  { icon: Link2, title: "Paste or search", body: "Drop an Amazon or Flipkart link, or just type the phone you want." },
  { icon: Scale, title: "Compare the exact variant", body: "Same storage, RAM and colour — matched across stores, never guessed." },
  { icon: LineChart, title: "Read the history", body: "A year of prices with lows, highs and averages so you know a real deal." },
  { icon: Bell, title: "Set an alert", body: "Pick your price. We'll ping you on email, Telegram or WhatsApp." },
];

export default async function Home() {
  const database = await db();
  const [deals, all] = await Promise.all([getDeals(database, 8), searchProducts(database, "", 8)]);
  const hero = deals[0];

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute right-0 top-40 size-72 rounded-full bg-amber-400/15 blur-3xl" />
        </div>
        <div className="container flex flex-col items-center pb-16 pt-16 text-center md:pt-24">
          <span className="animate-fade-up rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-soft">
            🇮🇳 Tracking Amazon.in &amp; Flipkart · smartphones
          </span>
          <h1 className="mt-6 max-w-3xl animate-fade-up font-display text-4xl font-extrabold tracking-tight [animation-delay:80ms] sm:text-6xl">
            Never overpay.
            <br />
            <span className="text-gradient">See the real price.</span>
          </h1>
          <p className="mt-5 max-w-xl animate-fade-up text-lg text-muted-foreground [animation-delay:160ms]">
            Compare live prices across stores for the exact variant you want, and check a full year of price history before you buy.
          </p>
          <div className="mt-8 flex w-full animate-fade-up justify-center [animation-delay:240ms]">
            <OmniSearch />
          </div>

          {hero && (
            <Link
              href={`/p/${hero.slug}?v=${hero.variantId}`}
              className="mt-12 flex w-full max-w-xl animate-fade-up items-center gap-5 rounded-2xl border border-border bg-card/80 p-4 text-left shadow-lift backdrop-blur [animation-delay:320ms]"
            >
              <PhoneArt colour={hero.colourHex} className="h-24 w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">▼ {Math.round(hero.dropPct ?? 0)}% in 30 days</p>
                <p className="truncate font-display font-bold">{hero.title}</p>
                <p className="truncate text-xs text-muted-foreground">{hero.variantLabel}</p>
              </div>
              <div className="text-right">
                <p className="tabular font-display text-xl font-extrabold">{formatINR(hero.pricePaise)}</p>
                {hero.referencePaise && <p className="tabular text-xs text-muted-foreground line-through">{formatINR(hero.referencePaise)}</p>}
              </div>
            </Link>
          )}
        </div>
      </section>

      <section aria-labelledby="drops" className="border-y border-border bg-muted/40 py-6">
        <h2 id="drops" className="sr-only">Trending price drops</h2>
        <div className="overflow-hidden">
          <ul className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
            {[...deals, ...deals].map((d, i) => (
              <li key={`${d.slug}-${i}`} aria-hidden={i >= deals.length}>
                <Link
                  href={`/p/${d.slug}?v=${d.variantId}`}
                  tabIndex={i >= deals.length ? -1 : undefined}
                  className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-soft"
                >
                  <span className="font-semibold">{d.title}</span>
                  <span className="tabular">{formatINR(d.pricePaise)}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">▼ {Math.round(d.dropPct ?? 0)}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="deals" aria-labelledby="deals-h" className="container py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="deals-h" className="font-display text-3xl font-extrabold tracking-tight">Today&apos;s best drops</h2>
            <p className="mt-1 text-muted-foreground">Biggest falls versus last month&apos;s price.</p>
          </div>
          <Link href="/deals" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">
            View all →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {(deals.length ? deals : all).map((c) => (
            <ProductCard key={c.slug} card={c} />
          ))}
        </div>
      </section>

      <section id="how" aria-labelledby="how-h" className="container py-16">
        <h2 id="how-h" className="text-center font-display text-3xl font-extrabold tracking-tight">How PriceVue works</h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
                <s.icon className="size-5" aria-hidden />
              </span>
              <p className="mt-4 text-xs font-bold text-muted-foreground">STEP {i + 1}</p>
              <h3 className="font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="alerts" className="container py-8">
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-8 text-white shadow-lift md:p-12">
          <div className="absolute -right-10 -top-10 size-60 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <h2 className="max-w-lg font-display text-3xl font-extrabold tracking-tight">Waiting for the right price?</h2>
          <p className="mt-2 max-w-lg text-white/85">
            Open any product, set your target and pick a channel. We watch every store so you don&apos;t have to.
          </p>
          <Link href="/search?q=" className="mt-6 inline-flex h-12 items-center rounded-xl bg-white px-6 font-semibold text-violet-700 shadow-soft">
            Find a product to watch
          </Link>
        </div>
      </section>
    </>
  );
}
