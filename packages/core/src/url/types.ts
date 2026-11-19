import type { StoreId } from "../stores";

export type ParsedProductUrl =
  | {
      ok: true;
      store: StoreId;
      /** Store-native identifier: ASIN for Amazon, FSN/pid (or itm id) for Flipkart. */
      externalId: string;
      idType: "asin" | "fsn" | "itm";
      canonicalUrl: string;
    }
  | {
      ok: true;
      store: StoreId;
      /** Short/redirect links (amzn.in, fkrt.it) must be resolved server-side first. */
      needsResolution: true;
      url: string;
    }
  | {
      ok: false;
      reason: "invalid_url" | "unsupported_store" | "not_a_product_url";
    };

export function toUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

export function hostMatches(hostname: string, domains: string[]): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return domains.some((d) => h === d || h.endsWith(`.${d}`));
}
