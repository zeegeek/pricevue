import { DEFAULT_AMAZON_ASSOCIATE_TAG, withAmazonTag } from "../affiliate";
import { rupeesToPaise } from "../money";
import { parseAmazonUrl } from "../url/amazon";
import {
  AdapterNotConfiguredError,
  type AdapterCapabilities,
  type Fetcher,
  type ListingDetails,
  type OfferSnapshot,
  type SearchResult,
  type StoreAdapter,
} from "./types";

/** Associates terms: offer data from the API may be cached for at most 1 hour. */
export const AMAZON_OFFER_MAX_AGE_MS = 60 * 60 * 1000;

export const AMAZON_CREATORS_API_BASE = "https://creatorsapi.amazon";

/** LwA token endpoint per credential version (amazon.in uses the EU region, version 3.2). */
const TOKEN_ENDPOINTS: Record<string, string> = {
  "3.1": "https://api.amazon.com/auth/o2/token",
  "3.2": "https://api.amazon.co.uk/auth/o2/token",
  "3.3": "https://api.amazon.co.jp/auth/o2/token",
};
const DEFAULT_VERSION = "3.2";

const RESOURCES = [
  "itemInfo.title",
  "itemInfo.byLineInfo",
  "itemInfo.externalIds",
  "itemInfo.manufactureInfo",
  "images.primary.large",
  "offersV2.listings.price",
  "offersV2.listings.availability",
  "offersV2.listings.merchantInfo",
  "offersV2.listings.isBuyBoxWinner",
];

export interface AmazonCreatorsConfig {
  credentialId?: string;
  credentialSecret?: string;
  version?: string;
  associateTag: string;
  marketplace: string;
}

export function amazonConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): AmazonCreatorsConfig {
  return {
    credentialId: env.AMAZON_CREATORS_API_CREDENTIAL_ID || undefined,
    credentialSecret: env.AMAZON_CREATORS_API_CREDENTIAL_SECRET || undefined,
    version: env.AMAZON_CREATORS_API_VERSION || undefined,
    associateTag: env.AMAZON_ASSOCIATE_TAG || DEFAULT_AMAZON_ASSOCIATE_TAG,
    marketplace: env.AMAZON_MARKETPLACE || "www.amazon.in",
  };
}

interface Money {
  amount?: number;
  currency?: string;
}

export interface CreatorsApiItem {
  asin: string;
  detailPageURL?: string;
  images?: { primary?: Record<string, { url?: string } | null> | null } | null;
  itemInfo?: {
    title?: { displayValue?: string } | null;
    byLineInfo?: { brand?: { displayValue?: string } | null } | null;
    externalIds?: { eans?: { displayValues?: string[] } | null } | null;
    manufactureInfo?: { model?: { displayValue?: string } | null } | null;
  } | null;
  offersV2?: {
    listings?: Array<{
      isBuyBoxWinner?: boolean;
      availability?: { type?: string } | null;
      merchantInfo?: { name?: string } | null;
      price?: {
        money?: Money | null;
        savingBasis?: { money?: Money | null; savingBasisType?: string } | null;
      } | null;
    }> | null;
  } | null;
}

export interface CreatorsApiResponse {
  itemsResult?: { items?: CreatorsApiItem[] | null } | null;
  searchResult?: { items?: CreatorsApiItem[] | null } | null;
  errors?: Array<{ code?: string; message?: string }> | null;
}

export interface AmazonItem {
  asin: string;
  title: string;
  url: string;
  brand?: string;
  gtin?: string;
  mpn?: string;
  imageUrl?: string;
  pricePaise?: number;
  mrpPaise?: number;
  inStock: boolean;
  seller?: string;
}

const toPaise = (m?: Money | null) =>
  typeof m?.amount === "number" && (!m.currency || m.currency === "INR")
    ? rupeesToPaise(m.amount)
    : undefined;

/** Maps a Creators API item to PriceVue's shape. Links always carry our Associates tag. */
export function mapCreatorsItem(
  item: CreatorsApiItem,
  tag = DEFAULT_AMAZON_ASSOCIATE_TAG,
): AmazonItem {
  const listings = item.offersV2?.listings ?? [];
  const listing = listings.find((l) => l.isBuyBoxWinner) ?? listings[0];
  const primary = item.images?.primary;
  const pricePaise = toPaise(listing?.price?.money);
  const mrpPaise = toPaise(listing?.price?.savingBasis?.money);
  return {
    asin: item.asin,
    title: item.itemInfo?.title?.displayValue ?? item.asin,
    url: withAmazonTag(item.asin, tag),
    brand: item.itemInfo?.byLineInfo?.brand?.displayValue,
    gtin: item.itemInfo?.externalIds?.eans?.displayValues?.[0],
    mpn: item.itemInfo?.manufactureInfo?.model?.displayValue,
    imageUrl: primary?.large?.url ?? primary?.medium?.url ?? primary?.small?.url ?? undefined,
    pricePaise,
    mrpPaise: mrpPaise && pricePaise && mrpPaise > pricePaise ? mrpPaise : undefined,
    inStock:
      pricePaise !== undefined &&
      (listing?.availability?.type ?? "IN_STOCK").startsWith("IN_STOCK"),
    seller: listing?.merchantInfo?.name,
  };
}

/** Client for the Amazon Creators API (OAuth2 client credentials via Login with Amazon). */
export class AmazonCreatorsApiClient {
  private token?: { value: string; expiresAt: number };
  private readonly cache = new Map<string, { item: AmazonItem | null; at: number }>();

  constructor(
    private readonly config: AmazonCreatorsConfig,
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  missingCredentials(): string[] {
    const missing: string[] = [];
    if (!this.config.credentialId) missing.push("AMAZON_CREATORS_API_CREDENTIAL_ID");
    if (!this.config.credentialSecret) missing.push("AMAZON_CREATORS_API_CREDENTIAL_SECRET");
    return missing;
  }

  /** Returns items by ASIN; results are cached for at most {@link AMAZON_OFFER_MAX_AGE_MS}. */
  async getItems(asins: string[]): Promise<Map<string, AmazonItem | null>> {
    const out = new Map<string, AmazonItem | null>();
    const stale = asins.filter((asin) => {
      const hit = this.cache.get(asin);
      if (hit && this.now() - hit.at < AMAZON_OFFER_MAX_AGE_MS) out.set(asin, hit.item);
      return !out.has(asin);
    });
    // GetItems accepts up to 10 ASINs per request.
    for (let i = 0; i < stale.length; i += 10) {
      const batch = stale.slice(i, i + 10);
      const res = await this.call("/catalog/v1/getItems", { itemIds: batch, itemIdType: "ASIN" });
      const items = new Map((res.itemsResult?.items ?? []).map((it) => [it.asin, it]));
      for (const asin of batch) {
        const raw = items.get(asin);
        const item = raw ? mapCreatorsItem(raw, this.config.associateTag) : null;
        this.cache.set(asin, { item, at: this.now() });
        out.set(asin, item);
      }
    }
    return out;
  }

  async searchItems(keywords: string, limit = 10): Promise<AmazonItem[]> {
    const res = await this.call("/catalog/v1/searchItems", {
      keywords,
      itemCount: Math.min(limit, 10),
    });
    return (res.searchResult?.items ?? []).map((it) =>
      mapCreatorsItem(it, this.config.associateTag),
    );
  }

  private async call(path: string, body: Record<string, unknown>): Promise<CreatorsApiResponse> {
    const res = await this.fetcher(`${AMAZON_CREATORS_API_BASE}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        "content-type": "application/json",
        "x-marketplace": this.config.marketplace,
      },
      body: JSON.stringify({
        ...body,
        marketplace: this.config.marketplace,
        partnerTag: this.config.associateTag,
        resources: RESOURCES,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as CreatorsApiResponse;
    if (!res.ok && !json.itemsResult && !json.searchResult) {
      const err = json.errors?.[0];
      throw new Error(
        `Amazon Creators API ${res.status}: ${err?.code ?? ""} ${err?.message ?? ""}`.trim(),
      );
    }
    return json;
  }

  private async accessToken(): Promise<string> {
    const missing = this.missingCredentials();
    if (missing.length) throw new AdapterNotConfiguredError("amazon", missing, "Amazon API");
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    const version = this.config.version ?? DEFAULT_VERSION;
    const endpoint = TOKEN_ENDPOINTS[version];
    if (!endpoint)
      throw new Error(
        `Unsupported AMAZON_CREATORS_API_VERSION "${version}" (expected 3.1, 3.2 or 3.3)`,
      );
    const res = await this.fetcher(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.config.credentialId,
        client_secret: this.config.credentialSecret,
        scope: "creatorsapi::default",
      }),
    });
    if (!res.ok) throw new Error(`Amazon Creators API token request failed: ${res.status}`);
    const { access_token, expires_in } = (await res.json()) as {
      access_token: string;
      expires_in?: number;
    };
    this.token = {
      value: access_token,
      expiresAt: this.now() + ((expires_in ?? 3600) - 60) * 1000,
    };
    return access_token;
  }
}

export class AmazonAdapter implements StoreAdapter {
  readonly id = "amazon" as const;
  readonly capabilities: AdapterCapabilities = {
    search: true,
    listing: true,
    offer: true,
    affiliate: true,
    officialApi: true,
  };
  private readonly client: AmazonCreatorsApiClient;

  constructor(
    readonly config: AmazonCreatorsConfig = amazonConfigFromEnv(),
    fetcher?: Fetcher,
    now?: () => number,
  ) {
    this.client = new AmazonCreatorsApiClient(config, fetcher, now);
  }

  isConfigured(): boolean {
    return this.client.missingCredentials().length === 0;
  }

  parseUrl(url: string) {
    return parseAmazonUrl(url);
  }

  async search(query: string, opts?: { limit?: number }): Promise<SearchResult[]> {
    const items = await this.client.searchItems(query, opts?.limit);
    return items.map((i) => ({
      store: "amazon",
      externalId: i.asin,
      title: i.title,
      url: i.url,
      imageUrl: i.imageUrl,
      pricePaise: i.pricePaise,
    }));
  }

  async getListing(asin: string): Promise<ListingDetails | null> {
    const item = (await this.client.getItems([asin])).get(asin);
    if (!item) return null;
    return {
      store: "amazon",
      externalId: asin,
      title: item.title,
      url: item.url,
      brand: item.brand,
      imageUrl: item.imageUrl,
      gtin: item.gtin,
      mpn: item.mpn,
    };
  }

  async getOffer(asin: string): Promise<OfferSnapshot | null> {
    const item = (await this.client.getItems([asin])).get(asin);
    if (!item?.pricePaise) return null;
    return {
      store: "amazon",
      externalId: asin,
      listedPaise: item.pricePaise,
      shippingPaise: 0,
      mrpPaise: item.mrpPaise,
      inStock: item.inStock,
      seller: item.seller,
      capturedAt: new Date(),
      source: "api",
    };
  }
}
