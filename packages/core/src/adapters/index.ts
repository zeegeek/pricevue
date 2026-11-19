import type { StoreId } from "../stores";
import { detectStore } from "../url";
import { AmazonAdapter, amazonConfigFromEnv } from "./amazon";
import { FlipkartAdapter, flipkartConfigFromEnv } from "./flipkart";
import type { Fetcher, StoreAdapter } from "./types";

export * from "./types";
export * from "./amazon";
export * from "./flipkart";

export type AdapterRegistry = Partial<Record<StoreId, StoreAdapter>>;

/** New stores (Myntra, Ajio, Croma…) plug in here by implementing StoreAdapter. */
export function createAdapterRegistry(
  env: Record<string, string | undefined> = process.env,
  fetcher?: Fetcher,
): AdapterRegistry {
  return {
    amazon: new AmazonAdapter(amazonConfigFromEnv(env), fetcher),
    flipkart: new FlipkartAdapter(flipkartConfigFromEnv(env), fetcher),
  };
}

export function adapterForUrl(registry: AdapterRegistry, url: string): StoreAdapter | null {
  const store = detectStore(url);
  return store ? (registry[store as StoreId] ?? null) : null;
}
