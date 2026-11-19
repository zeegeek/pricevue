import { formatINR, rankOffers, savingsVsNextBest, STORES, type StoreId } from "@pricevue/core";
import { cn } from "@pricevue/ui";
import { ExternalLink } from "lucide-react";
import { StoreName } from "./store-badge";

export interface OfferRow {
  listingId: number;
  storeId: StoreId;
  seller: string | null;
  listedPaise: number;
  shippingPaise: number;
  mrpPaise: number | null;
  inStock: boolean;
  stockLabel: string | null;
  bankOffer: string | null;
  couponOffer: string | null;
  lastCheckedAt: Date | null;
}

function ago(d: Date | null, now: number) {
  if (!d) return "—";
  const mins = Math.max(1, Math.round((now - d.getTime()) / 60000));
  return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
}

export function ComparisonTable({ offers, now }: { offers: OfferRow[]; now: number }) {
  const ranked = rankOffers(offers);
  const savings = savingsVsNextBest(ranked);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <h2 className="font-display text-lg font-bold">Compare prices</h2>
        {savings ? (
          <p className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Save {formatINR(savings)} vs next best
          </p>
        ) : null}
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Current prices for this exact variant by store, best payable price first</caption>
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">Store</th>
            <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">Offers</th>
            <th scope="col" className="px-3 py-3 text-right font-semibold">Payable</th>
            <th scope="col" className="px-5 py-3"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {ranked.map(({ offer, payablePaise, isBest, diffFromBestPaise }) => (
            <tr key={offer.listingId} className={cn("border-t border-border", isBest && "bg-brand-50/70 dark:bg-brand-500/10")}>
              <td className="px-5 py-4 align-top">
                <StoreName store={offer.storeId} />
                {isBest && <p className="mt-1 text-xs font-bold text-brand-700 dark:text-brand-400">★ Best price</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {offer.seller} · checked {ago(offer.lastCheckedAt, now)}
                </p>
              </td>
              <td className="hidden px-3 py-4 align-top text-xs text-muted-foreground md:table-cell">
                {offer.bankOffer && <p>{offer.bankOffer}</p>}
                {offer.couponOffer && <p className="text-brand-700 dark:text-brand-400">{offer.couponOffer}</p>}
                <p>{offer.shippingPaise ? `+${formatINR(offer.shippingPaise)} delivery` : "Free delivery"}</p>
              </td>
              <td className="px-3 py-4 text-right align-top">
                <p className={cn("tabular font-display text-lg font-extrabold", !offer.inStock && "text-muted-foreground line-through")}>{formatINR(payablePaise)}</p>
                {!offer.inStock ? (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{offer.stockLabel ?? "Out of stock"}</p>
                ) : diffFromBestPaise > 0 ? (
                  <p className="tabular text-xs font-semibold text-rose-600 dark:text-rose-400">▲ {formatINR(diffFromBestPaise)} more</p>
                ) : offer.mrpPaise ? (
                  <p className="tabular text-xs text-muted-foreground">MRP <span className="line-through">{formatINR(offer.mrpPaise)}</span></p>
                ) : null}
              </td>
              <td className="px-5 py-4 text-right align-top">
                <a
                  href={`/go/${offer.listingId}`}
                  rel="nofollow sponsored noopener"
                  target="_blank"
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition",
                    isBest ? "bg-brand-gradient text-white shadow-glow hover:brightness-110" : "border border-border hover:border-brand-400",
                  )}
                >
                  Buy <ExternalLink className="size-3.5" aria-hidden />
                  <span className="sr-only">on {STORES[offer.storeId].name} (opens in new tab)</span>
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
