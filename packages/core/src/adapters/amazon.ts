import { DEFAULT_AMAZON_ASSOCIATE_TAG } from "../affiliate";
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

export interface AmazonCreatorsConfig {
  credentialId?: string;
  credentialSecret?: string;
  version?: string;
  associateTag: string;
  marketplace: string;
}

export function amazonConfigFromEnv(env: Record<string, string | undefined> = process.env): AmazonCreatorsConfig {
  return {
    credentialId: env.AMAZON_CREATORS_API_CREDENTIAL_ID || undefined,
    credentialSecret: env.AMAZON_CREATORS_API_CREDENTIAL_SECRET || undefined,
    version: env.AMAZON_CREATORS_API_VERSION || undefined,
    associateTag: env.AMAZON_ASSOCIATE_TAG || DEFAULT_AMAZON_ASSOCIATE_TAG,
    marketplace: env.AMAZON_MARKETPLACE || "www.amazon.in",
  };
}

/**
 * Thin client for the Amazon Creators API.
 *
 * Phase 1: credentials are not issued yet, so request signing/transport is a stub. The
 * adapter surface is final, so wiring the real client later won't affect callers.
 */
export class AmazonCreatorsApiClient {
  constructor(
    private readonly config: AmazonCreatorsConfig,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  missingCredentials(): string[] {
    const missing: string[] = [];
    if (!this.config.credentialId) missing.push("AMAZON_CREATORS_API_CREDENTIAL_ID");
    if (!this.config.credentialSecret) missing.push("AMAZON_CREATORS_API_CREDENTIAL_SECRET");
    return missing;
  }

  async getItems(_asins: string[]): Promise<never> {
    this.assertConfigured();
    void this.fetcher;
    throw new Error("Amazon Creators API transport not implemented yet (awaiting credentials)");
  }

  async searchItems(_keywords: string): Promise<never> {
    this.assertConfigured();
    throw new Error("Amazon Creators API transport not implemented yet (awaiting credentials)");
  }

  private assertConfigured() {
    const missing = this.missingCredentials();
    if (missing.length) throw new AdapterNotConfiguredError("amazon", missing);
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
  ) {
    this.client = new AmazonCreatorsApiClient(config, fetcher);
  }

  isConfigured(): boolean {
    return this.client.missingCredentials().length === 0;
  }

  parseUrl(url: string) {
    return parseAmazonUrl(url);
  }

  async search(query: string): Promise<SearchResult[]> {
    return this.client.searchItems(query);
  }

  async getListing(asin: string): Promise<ListingDetails | null> {
    return this.client.getItems([asin]);
  }

  async getOffer(asin: string): Promise<OfferSnapshot | null> {
    return this.client.getItems([asin]);
  }
}
