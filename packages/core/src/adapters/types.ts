import type { Paise } from "../money";
import type { StoreId } from "../stores";
import type { ParsedProductUrl } from "../url/types";

export interface AdapterCapabilities {
  /** Keyword search on the store. */
  search: boolean;
  /** Fetch listing details (title, images, attributes). */
  listing: boolean;
  /** Fetch current price/offer. */
  offer: boolean;
  /** Store supports affiliate links. */
  affiliate: boolean;
  /** Data comes from an official API (vs. scraping fallback). */
  officialApi: boolean;
}

export interface SearchResult {
  store: StoreId;
  externalId: string;
  title: string;
  url: string;
  imageUrl?: string;
  pricePaise?: Paise;
}

export interface ListingDetails {
  store: StoreId;
  externalId: string;
  title: string;
  url: string;
  brand?: string;
  imageUrl?: string;
  attributes?: Record<string, string>;
}

export interface OfferSnapshot {
  store: StoreId;
  externalId: string;
  listedPaise: Paise;
  shippingPaise: Paise;
  mrpPaise?: Paise;
  inStock: boolean;
  seller?: string;
  capturedAt: Date;
  source: "api" | "scraper" | "fixture";
}

export interface StoreAdapter {
  readonly id: StoreId;
  readonly capabilities: AdapterCapabilities;
  /** True when credentials/config needed for network calls are present. */
  isConfigured(): boolean;
  parseUrl(url: string): ParsedProductUrl;
  search(query: string, opts?: { limit?: number }): Promise<SearchResult[]>;
  getListing(externalId: string): Promise<ListingDetails | null>;
  getOffer(externalId: string): Promise<OfferSnapshot | null>;
}

export class AdapterNotConfiguredError extends Error {
  constructor(store: StoreId, missing: string[]) {
    super(`${store} adapter is not configured (missing: ${missing.join(", ")})`);
    this.name = "AdapterNotConfiguredError";
  }
}

export class CapabilityNotSupportedError extends Error {
  constructor(store: StoreId, capability: keyof AdapterCapabilities) {
    super(`${store} adapter does not support "${capability}"`);
    this.name = "CapabilityNotSupportedError";
  }
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
