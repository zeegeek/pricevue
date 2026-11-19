import {
  AdapterNotConfiguredError,
  CapabilityNotSupportedError,
  RobotsDisallowedError,
  type OfferSnapshot,
  type StoreAdapter,
  type StoreId,
} from "@pricevue/core";

export const REFRESH_QUEUE = "refresh-offers";

export interface RefreshJob {
  listingId: number;
  storeId: StoreId;
  externalId: string;
  url: string;
}

export type RefreshOutcome =
  { status: "updated"; offer: OfferSnapshot } | { status: "skipped"; reason: string } | { status: "missing" };

export interface OfferSink {
  saveOffer(listingId: number, offer: OfferSnapshot): Promise<void>;
}

/** Fetches the latest offer for a listing; adapters that aren't configured are skipped, not failed. */
export async function processRefresh(
  job: RefreshJob,
  adapters: Partial<Record<StoreId, StoreAdapter>>,
  sink: OfferSink,
): Promise<RefreshOutcome> {
  const adapter = adapters[job.storeId];
  if (!adapter) return { status: "skipped", reason: `no adapter for ${job.storeId}` };
  try {
    const offer = await adapter.getOffer(job.externalId, { url: job.url });
    if (!offer) return { status: "missing" };
    await sink.saveOffer(job.listingId, offer);
    return { status: "updated", offer };
  } catch (error) {
    if (
      error instanceof AdapterNotConfiguredError ||
      error instanceof CapabilityNotSupportedError ||
      error instanceof RobotsDisallowedError
    ) {
      return { status: "skipped", reason: error.message };
    }
    throw error;
  }
}
