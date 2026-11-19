import type { StoreId } from "./stores";
import { amazonCanonicalUrl, isAsin } from "./url/amazon";
import { toUrl } from "./url/types";

/** PriceVue's Amazon Associates tag. Every outbound Amazon link must carry it. */
export const DEFAULT_AMAZON_ASSOCIATE_TAG = "pricevue-21";

export interface AffiliateConfig {
  amazonTag?: string;
  flipkartAffiliateId?: string;
}

export function affiliateConfigFromEnv(env: Record<string, string | undefined> = process.env): AffiliateConfig {
  return {
    amazonTag: env.AMAZON_ASSOCIATE_TAG || DEFAULT_AMAZON_ASSOCIATE_TAG,
    flipkartAffiliateId: env.FLIPKART_AFFILIATE_ID || undefined,
  };
}

// Params that would leak someone else's attribution or tracking.
const AMAZON_STRIP_PARAMS = ["tag", "ascsubtag", "linkCode", "linkId", "ref_", "creative", "camp", "creativeASIN"];

/** Returns the Amazon URL with exactly one `tag` — PriceVue's. */
export function withAmazonTag(urlOrAsin: string, tag = DEFAULT_AMAZON_ASSOCIATE_TAG): string {
  const url = isAsin(urlOrAsin) ? new URL(amazonCanonicalUrl(urlOrAsin)) : toUrl(urlOrAsin);
  if (!url) throw new Error(`Invalid Amazon URL: ${urlOrAsin}`);
  for (const p of AMAZON_STRIP_PARAMS) url.searchParams.delete(p);
  url.searchParams.set("tag", tag || DEFAULT_AMAZON_ASSOCIATE_TAG);
  return url.toString();
}

export function withFlipkartAffiliate(url: string, affid?: string): string {
  const u = toUrl(url);
  if (!u) throw new Error(`Invalid Flipkart URL: ${url}`);
  u.searchParams.delete("affid");
  if (affid) u.searchParams.set("affid", affid);
  return u.toString();
}

/** Builds the outbound "Buy" URL for a store listing. */
export function buildAffiliateUrl(store: StoreId, url: string, config: AffiliateConfig = {}): string {
  switch (store) {
    case "amazon":
      return withAmazonTag(url, config.amazonTag ?? DEFAULT_AMAZON_ASSOCIATE_TAG);
    case "flipkart":
      return withFlipkartAffiliate(url, config.flipkartAffiliateId);
    default:
      return url;
  }
}
