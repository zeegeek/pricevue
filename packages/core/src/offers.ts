import type { Paise } from "./money";
import type { StoreId } from "./stores";

export interface ComparableOffer {
  storeId: StoreId;
  listedPaise: Paise;
  shippingPaise: Paise;
  inStock: boolean;
}

export interface RankedOffer<T extends ComparableOffer> {
  offer: T;
  payablePaise: Paise;
  isBest: boolean;
  /** How much more than the best payable price (0 for the best offer). */
  diffFromBestPaise: Paise;
}

export function payable(offer: ComparableOffer): Paise {
  return offer.listedPaise + offer.shippingPaise;
}

/**
 * Ranks offers by payable price (listed + shipping). Bank/coupon offers are intentionally
 * excluded because they depend on the buyer's eligibility. Out-of-stock offers sort last
 * and can never be "best".
 */
export function rankOffers<T extends ComparableOffer>(offers: T[]): RankedOffer<T>[] {
  const sorted = [...offers].sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    return payable(a) - payable(b);
  });
  const best = sorted.find((o) => o.inStock);
  const bestPayable = best ? payable(best) : 0;
  return sorted.map((offer) => ({
    offer,
    payablePaise: payable(offer),
    isBest: offer === best,
    diffFromBestPaise: best ? payable(offer) - bestPayable : 0,
  }));
}

/** Savings of the best in-stock offer versus the next best in-stock one. */
export function savingsVsNextBest<T extends ComparableOffer>(ranked: RankedOffer<T>[]): Paise | null {
  const inStock = ranked.filter((r) => r.offer.inStock);
  if (inStock.length < 2) return null;
  return inStock[1]!.payablePaise - inStock[0]!.payablePaise;
}
