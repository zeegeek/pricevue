import { rupeesToPaise } from "../money";
import { parseFlipkartUrl } from "../url/flipkart";
import {
  AdapterNotConfiguredError,
  CapabilityNotSupportedError,
  type AdapterCapabilities,
  type Fetcher,
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

/**
 * Extracts product + price data from a Flipkart product page using its JSON-LD block.
 * Pure function so it can be tested with saved fixtures (no live scraping in tests).
 */
export function parseFlipkartProductHtml(html: string): ScrapedFlipkartProduct | null {
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
    const price = Number(String(offer?.price ?? "").replace(/[^\d.]/g, ""));
    if (!offer || !Number.isFinite(price) || price <= 0) continue;

    const mrpMatch = html.match(/data-mrp=["']([\d,]+)["']/);
    return {
      title: product.name.trim(),
      brand: typeof product.brand === "string" ? product.brand : product.brand?.name,
      imageUrl: Array.isArray(product.image) ? product.image[0] : product.image,
      pricePaise: rupeesToPaise(price),
      mrpPaise: mrpMatch ? rupeesToPaise(Number(mrpMatch[1]!.replace(/,/g, ""))) : undefined,
      inStock: !/OutOfStock|SoldOut/i.test(offer.availability ?? ""),
      seller: offer.seller?.name,
    };
  }
  return null;
}

export class FlipkartAdapter implements StoreAdapter {
  readonly id = "flipkart" as const;
  readonly capabilities: AdapterCapabilities;

  constructor(
    readonly config: FlipkartConfig = flipkartConfigFromEnv(),
    private readonly fetcher: Fetcher = fetch,
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

  async getListing(externalId: string): Promise<ListingDetails | null> {
    const scraped = await this.scrape(externalId);
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

  async getOffer(externalId: string): Promise<OfferSnapshot | null> {
    const scraped = await this.scrape(externalId);
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

  private async scrape(externalId: string) {
    if (!this.config.scraperEnabled) {
      throw new AdapterNotConfiguredError("flipkart", ["FLIPKART_SCRAPER_ENABLED=true"]);
    }
    const url = externalId.startsWith("itm")
      ? `https://www.flipkart.com/product/p/${externalId}`
      : `https://www.flipkart.com/product/p/itm?pid=${externalId}`;
    const res = await this.fetcher(url, {
      headers: { "user-agent": "PriceVueBot/0.1 (+https://pricevue.in/bot)", accept: "text/html" },
    });
    if (!res.ok) return null;
    const product = parseFlipkartProductHtml(await res.text());
    return product ? { url, product } : null;
  }
}
