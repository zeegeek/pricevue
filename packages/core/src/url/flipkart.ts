import { hostMatches, toUrl, type ParsedProductUrl } from "./types";

export const FLIPKART_DOMAINS = ["flipkart.com"];
export const FLIPKART_SHORT_DOMAINS = ["fkrt.it", "fkrt.cc", "fkrt.co"];

/** Flipkart Serial Number (FSN), e.g. MOBGTAGPTB3VS24W — 16 upper-case alphanumerics. */
const FSN_RE = /^[A-Z0-9]{16}$/;
const ITM_RE = /\/p\/(itm[a-z0-9]{6,})(?=[/?#]|$)/i;

export function isFsn(value: string): boolean {
  return FSN_RE.test(value);
}

export function flipkartCanonicalUrl(id: { fsn?: string; itm?: string }, slug = "product"): string {
  const base = `https://www.flipkart.com/${slug}/p/${id.itm ?? "itm"}`;
  return id.fsn ? `${base}?pid=${id.fsn}` : base;
}

export function parseFlipkartUrl(input: string): ParsedProductUrl {
  const url = toUrl(input);
  if (!url) return { ok: false, reason: "invalid_url" };

  if (hostMatches(url.hostname, FLIPKART_SHORT_DOMAINS)) {
    return { ok: true, store: "flipkart", needsResolution: true, url: url.toString() };
  }
  if (!hostMatches(url.hostname, FLIPKART_DOMAINS)) {
    return { ok: false, reason: "unsupported_store" };
  }

  // dl.flipkart.com/dl/<slug>/p/<itm>?pid=… is the app deep-link form.
  const path = url.pathname.replace(/^\/dl(?=\/)/, "");
  const segments = path.split("/").filter(Boolean);
  const pIndex = segments.indexOf("p");
  const slug = pIndex > 0 ? segments[pIndex - 1]! : "product";
  const itm = path.match(ITM_RE)?.[1]?.toLowerCase();
  const pid = url.searchParams.get("pid")?.toUpperCase();

  if (pid && isFsn(pid)) {
    return {
      ok: true,
      store: "flipkart",
      externalId: pid,
      idType: "fsn",
      canonicalUrl: flipkartCanonicalUrl({ fsn: pid, itm }, slug),
    };
  }
  if (itm) {
    return {
      ok: true,
      store: "flipkart",
      externalId: itm,
      idType: "itm",
      canonicalUrl: flipkartCanonicalUrl({ itm }, slug),
    };
  }
  return { ok: false, reason: "not_a_product_url" };
}
