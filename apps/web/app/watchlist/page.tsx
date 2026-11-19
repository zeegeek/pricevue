import { formatINR, STORES } from "@pricevue/core";
import { getWatchlist } from "@pricevue/db";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signInUrl } from "@/auth";
import { db } from "@/lib/db";
import { removeFromWatchlist } from "./actions";

export const metadata: Metadata = { title: "Your watchlist" };

export default async function WatchlistPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect(signInUrl("/watchlist"));
  const items = await getWatchlist(await db(), userId);

  return (
    <div className="container py-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Your watchlist</h1>
      {items.length === 0 ? (
        <p className="mt-4 text-muted-foreground">
          Nothing tracked yet. Open any product and hit <span className="font-semibold">Track price</span>.{" "}
          <Link href="/search?q=" className="font-semibold text-brand-700 hover:underline dark:text-brand-400">Browse phones</Link>
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((it) => {
            const hit = it.bestPaise != null && it.targetPaise != null && it.bestPaise <= it.targetPaise;
            return (
              <li key={it.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${it.slug}?v=${it.variantId}`} className="font-semibold hover:underline">{it.title}</Link>
                  <p className="text-sm text-muted-foreground">{it.brand} · {it.variantLabel}</p>
                </div>
                <div className="text-right">
                  <p className="tabular font-display text-lg font-bold">{it.bestPaise != null ? formatINR(it.bestPaise) : "Out of stock"}</p>
                  {it.bestStoreId && <p className="text-xs text-muted-foreground">on {STORES[it.bestStoreId].name}</p>}
                </div>
                <div className="w-32 text-right text-sm">
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className={hit ? "font-semibold text-emerald-600" : "font-semibold"}>
                    {it.targetPaise != null ? formatINR(it.targetPaise) : "—"}
                    {hit && " ✓"}
                  </p>
                </div>
                <form action={removeFromWatchlist.bind(null, it.variantId)}>
                  <button type="submit" className="h-9 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted">Remove</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
