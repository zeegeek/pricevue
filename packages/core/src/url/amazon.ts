import { hostMatches, toUrl, type ParsedProductUrl } from "./types";

export const AMAZON_DOMAINS = ["amazon.in"];
export const AMAZON_SHORT_DOMAINS = ["amzn.in", "amzn.to", "a.co"];

const ASIN_PATH_PATTERNS = [
  /\/dp\/([A-Z0-9]{10})(?=[/?#]|$)/i,
  /\/gp\/product\/([A-Z0-9]{10})(?=[/?#]|$)/i,
  /\/gp\/aw\/d\/([A-Z0-9]{10})(?=[/?#]|$)/i,
  /\/gp\/offer-listing\/([A-Z0-9]{10})(?=[/?#]|$)/i,
  /\/exec\/obidos\/asin\/([A-Z0-9]{10})(?=[/?#]|$)/i,
  /\/product-reviews\/([A-Z0-9]{10})(?=[/?#]|$)/i,
];

const ASIN_RE = /^[A-Z0-9]{10}$/;

export function isAsin(value: string): boolean {
  return ASIN_RE.test(value.toUpperCase());
}

export function amazonCanonicalUrl(asin: string): string {
  return `https://www.amazon.in/dp/${asin.toUpperCase()}`;
}

export function parseAmazonUrl(input: string): ParsedProductUrl {
  const url = toUrl(input);
  if (!url) return { ok: false, reason: "invalid_url" };

  if (hostMatches(url.hostname, AMAZON_SHORT_DOMAINS)) {
    return { ok: true, store: "amazon", needsResolution: true, url: url.toString() };
  }
  if (!hostMatches(url.hostname, AMAZON_DOMAINS)) {
    return { ok: false, reason: "unsupported_store" };
  }

  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    path = url.pathname;
  }
  for (const re of ASIN_PATH_PATTERNS) {
    const m = path.match(re);
    if (m && isAsin(m[1]!)) {
      const asin = m[1]!.toUpperCase();
      return { ok: true, store: "amazon", externalId: asin, idType: "asin", canonicalUrl: amazonCanonicalUrl(asin) };
    }
  }
  const qAsin = url.searchParams.get("asin") ?? url.searchParams.get("ASIN");
  if (qAsin && isAsin(qAsin)) {
    const asin = qAsin.toUpperCase();
    return { ok: true, store: "amazon", externalId: asin, idType: "asin", canonicalUrl: amazonCanonicalUrl(asin) };
  }
  return { ok: false, reason: "not_a_product_url" };
}
