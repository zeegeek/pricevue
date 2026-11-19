import { AMAZON_DOMAINS, AMAZON_SHORT_DOMAINS, parseAmazonUrl } from "./amazon";
import { FLIPKART_DOMAINS, FLIPKART_SHORT_DOMAINS, parseFlipkartUrl } from "./flipkart";
import { hostMatches, toUrl, type ParsedProductUrl } from "./types";

export * from "./types";
export * from "./amazon";
export * from "./flipkart";

/** Domains of stores we recognise but don't support yet (shown as "coming soon"). */
const UPCOMING_DOMAINS: Record<string, string[]> = {
  myntra: ["myntra.com"],
  ajio: ["ajio.com"],
  croma: ["croma.com"],
};

/** True when the input looks like a URL rather than a product name. */
export function looksLikeUrl(input: string): boolean {
  const v = input.trim();
  if (/^https?:\/\//i.test(v)) return true;
  return /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*/i.test(v);
}

export function detectStore(input: string): string | null {
  const url = toUrl(input);
  if (!url) return null;
  if (hostMatches(url.hostname, [...AMAZON_DOMAINS, ...AMAZON_SHORT_DOMAINS])) return "amazon";
  if (hostMatches(url.hostname, [...FLIPKART_DOMAINS, ...FLIPKART_SHORT_DOMAINS])) return "flipkart";
  for (const [store, domains] of Object.entries(UPCOMING_DOMAINS)) {
    if (hostMatches(url.hostname, domains)) return store;
  }
  return null;
}

/** Parses any supported store's product URL. */
export function parseProductUrl(input: string): ParsedProductUrl {
  const store = detectStore(input);
  if (store === "amazon") return parseAmazonUrl(input);
  if (store === "flipkart") return parseFlipkartUrl(input);
  if (!toUrl(input)) return { ok: false, reason: "invalid_url" };
  return { ok: false, reason: "unsupported_store" };
}
