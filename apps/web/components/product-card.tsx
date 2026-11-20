import { formatINR, type StoreId } from "@pricevue/core";
import type { ProductCard as Card } from "@pricevue/db";
import { Badge } from "@pricevue/ui";
import { TrendingDown } from "lucide-react";
import Link from "next/link";
import { PhoneArt } from "./phone-art";
import { StoreMark } from "./store-badge";

const scoreTone = { great: "success", good: "brand", fair: "neutral" } as const;

export function ProductCard({ card, note }: { card: Card; note?: string }) {
  return (
    <Link
      href={`/p/${card.slug}?v=${card.variantId}`}
      className="group flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft transition duration-300 ease-out-expo hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="flex items-start justify-between">
        {card.score ? (
          <Badge tone={scoreTone[card.score]} className="capitalize">{card.score} deal</Badge>
        ) : (
          <Badge tone="neutral">{card.storeCount} {card.storeCount === 1 ? "store" : "stores"}</Badge>
        )}
        <StoreMark store={card.storeId as StoreId} />
      </div>
      <div className="relative mx-auto my-4 h-36 w-24">
        <div className="absolute inset-0 rounded-full bg-brand-500/15 blur-2xl transition group-hover:bg-brand-500/25" />
        <PhoneArt colour={card.colourHex} className="relative h-full w-full transition duration-500 ease-out-expo group-hover:scale-105" />
      </div>
      <p className="text-xs font-medium text-muted-foreground">{card.brand}</p>
      <h3 className="line-clamp-1 font-display font-bold">{card.title}</h3>
      <p className="line-clamp-1 text-xs text-muted-foreground">{card.variantLabel}</p>
      {note && <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{note}</p>}
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="tabular font-display text-xl font-extrabold">{formatINR(card.pricePaise)}</p>
          {card.referencePaise ? (
            <p className="tabular text-xs text-muted-foreground line-through">{formatINR(card.referencePaise)}</p>
          ) : card.mrpPaise ? (
            <p className="tabular text-xs text-muted-foreground">MRP <span className="line-through">{formatINR(card.mrpPaise)}</span></p>
          ) : null}
        </div>
        {card.dropPct ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <TrendingDown className="size-3.5" aria-hidden />
            {Math.round(card.dropPct)}%
          </span>
        ) : null}
      </div>
    </Link>
  );
}
