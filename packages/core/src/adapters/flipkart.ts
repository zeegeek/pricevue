import { rupeesToPaise } from "../money";
import { createPoliteFetcher } from "../http/polite-fetch";
import { parseFlipkartUrl } from "../url/flipkart";
import {
  AdapterNotConfiguredError,
  CapabilityNotSupportedError,
  type AdapterCapabilities,
  type Fetcher,
  type FetchHints,
  type ListingDetails,
  type OfferSnapshot,
  type SearchResult,
  type StoreAdapter,
} from "./types";

export interface FlipkartConfig {
  affiliateId?: string;
  affiliateToken?: string;
  /** Scraper fallback is opt-in and never used in tests. */
  scraperEnabled: boolean;
}

export function flipkartConfigFromEnv(env: Record<string, string | undefined> = process.env): FlipkartConfig {
  return {
    affiliateId: env.FLIPKART_AFFILIATE_ID || undefined,
    affiliateToken: env.FLIPKART_AFFILIATE_TOKEN || undefined,
    scraperEnabled: env.FLIPKART_SCRAPER_ENABLED === "true",
  };
}

export interface ScrapedFlipkartProduct {
  title: string;
  brand?: string;
  imageUrl?: string;
  pricePaise: number;
  mrpPaise?: number;
  inStock: boolean;
  seller?: string;
}

interface JsonLdOffer {
  price?: string | number;
  availability?: string;
  seller?: { name?: string };
}

interface JsonLdProduct {
  "@type"?: string | string[];
  name?: string;
  image?: string | string[];
  brand?: string | { name?: string };
  offers?: JsonLdOffer | JsonLdOffer[];
}

function asProducts(node: unknown): JsonLdProduct[] {
  if (Array.isArray(node)) return node.flatMap(asProducts);
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) return asProducts(obj["@graph"]);
    const type = obj["@type"];
    if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return [obj as JsonLdProduct];
  }
  return [];
}

interface StatePricing {
  pricePaise?: number;
  mrpPaise?: number;
  title?: string;
  inStock?: boolean;
}

const numValue = (v: unknown): number | undefined => {
  const n = typeof v === "object" && v ? (v as { value?: unknown }).value : v;
  const parsed = Number(String(n ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/** Reads pricing from Flipkart's embedded `window.__INITIAL_STATE__` JSON, if present. */
export function parseFlipkartEmbeddedState(html: string): StatePricing {
  const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/);
  if (!m) return {};
  let state: unknown;
  try {
    state = JSON.parse(m[1]!);
  } catch {
    return {};
  }
  const out: StatePricing = {};
  const stack: unknown[] = [state];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    const obj = node as Record<string, unknown>;
    if (out.pricePaise === undefined && obj.finalPrice !== undefined) {
      const price = numValue(obj.finalPrice);
      const mrp = numValue(obj.mrp);
      if (price) out.pricePaise = rupeesToPaise(price);
      if (mrp) out.mrpPaise = rupeesToPaise(mrp);
    }
    if (out.title === undefined && typeof obj.productTitle === "string") out.title = obj.productTitle.trim();
    if (out.inStock === undefined && typeof obj.availabilityStatus === "string") {
      out.inStock = !/OUT_OF_STOCK|SOLD_OUT|COMING_SOON/i.test(obj.availabilityStatus);
    }
    stack.push(...Object.values(obj));
  }
  return out;
}

const metaContent = (html: string, prop: string) =>
  html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1];

/**
 * Extracts product + price data from a Flipkart product page, preferring JSON-LD and falling
 * back to the embedded state. Pure function so it can be tested with saved fixtures.
 */
export function parseFlipkartProductHtml(html: string): ScrapedFlipkartProduct | null {
  const state = parseFlipkartEmbeddedState(html);
  const domMrp = html.match(/data-mrp=["']([\d,]+)["']/)?.[1];
  const mrpPaise = state.mrpPaise ?? (domMrp ? rupeesToPaise(Number(domMrp.replace(/,/g, ""))) : undefined);

  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, body] of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(body!.trim());
    } catch {
      continue;
    }
    const product = asProducts(data)[0];
    if (!product?.name) continue;
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    const price = numValue(offer?.price);
    if (!offer || !price) continue;

    return {
      title: product.name.trim(),
      brand: typeof product.brand === "string" ? product.brand : product.brand?.name,
      imageUrl: Array.isArray(product.image) ? product.image[0] : product.image,
      pricePaise: rupeesToPaise(price),
      mrpPaise,
      inStock: !/OutOfStock|SoldOut/i.test(offer.availability ?? ""),
      seller: offer.seller?.name,
    };
  }

  const title = state.title ?? metaContent(html, "og:title");
  if (!state.pricePaise || !title) return null;
  return {
    title,
    imageUrl: metaContent(html, "og:image"),
    pricePaise: state.pricePaise,
    mrpPaise,
    inStock: state.inStock ?? true,
  };
}

export class FlipkartAdapter implements StoreAdapter {
  readonly id = "flipkart" as const;
  readonly capabilities: AdapterCapabilities;

  constructor(
    readonly config: FlipkartConfig = flipkartConfigFromEnv(),
    private readonly fetcher: Fetcher = createPoliteFetcher(),
  ) {
    this.capabilities = {
      search: false,
      listing: config.scraperEnabled,
      offer: config.scraperEnabled,
      affiliate: true,
      officialApi: false,
    };
  }

  isConfigured(): boolean {
    return this.config.scraperEnabled;
  }

  parseUrl(url: string) {
    return parseFlipkartUrl(url);
  }

  async search(_query: string): Promise<SearchResult[]> {
    throw new CapabilityNotSupportedError("flipkart", "search");
  }

  async getListing(externalId: string, opts?: FetchHints): Promise<ListingDetails | null> {
    const scraped = await this.scrape(externalId, opts?.url);
    if (!scraped) return null;
    return {
      store: "flipkart",
      externalId,
      title: scraped.product.title,
      url: scraped.url,
      brand: scraped.product.brand,
      imageUrl: scraped.product.imageUrl,
    };
  }

  async getOffer(externalId: string, opts?: FetchHints): Promise<OfferSnapshot | null> {
    const scraped = await this.scrape(externalId, opts?.url);
    if (!scraped) return null;
    return {
      store: "flipkart",
      externalId,
      listedPaise: scraped.product.pricePaise,
      shippingPaise: 0,
      mrpPaise: scraped.product.mrpPaise,
      inStock: scraped.product.inStock,
      seller: scraped.product.seller,
      capturedAt: new Date(),
      source: "scraper",
    };
  }

  private async scrape(externalId: string, hintUrl?: string) {
    if (!this.config.scraperEnabled) {
      throw new AdapterNotConfiguredError("flipkart", ["FLIPKART_SCRAPER_ENABLED=true"]);
    }
    const parsed = hintUrl ? parseFlipkartUrl(hintUrl) : null;
    const url =
      parsed?.ok && "canonicalUrl" in parsed && parsed.externalId === externalId
        ? parsed.canonicalUrl
        : externalId.startsWith("itm")
          ? `https://www.flipkart.com/product/p/${externalId}`
          : `https://www.flipkart.com/product/p/itm?pid=${externalId}`;
    const res = await this.fetcher(url, { headers: { accept: "text/html" } });
    if (!res.ok) return null;
    const product = parseFlipkartProductHtml(await res.text());
    return product ? { url, product } : null;
  }
}
