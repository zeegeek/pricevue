import { describe, expect, it, vi } from "vitest";
import { createAdapterRegistry, type StoreAdapter } from "@pricevue/core";
import { processRefresh } from "./refresh";

const job = { listingId: 1, storeId: "amazon" as const, externalId: "B0CHX1W1XY", url: "https://www.amazon.in/dp/B0CHX1W1XY" };

describe("processRefresh", () => {
  it("skips unconfigured adapters instead of failing", async () => {
    const sink = { saveOffer: vi.fn() };
    const result = await processRefresh(job, createAdapterRegistry({}), sink);
    expect(result.status).toBe("skipped");
    expect(sink.saveOffer).not.toHaveBeenCalled();
  });

  it("saves offers returned by the adapter", async () => {
    const offer = { store: "amazon" as const, externalId: job.externalId, listedPaise: 5_999_900, shippingPaise: 0, inStock: true, capturedAt: new Date(), source: "fixture" as const };
    const adapter = { getOffer: vi.fn().mockResolvedValue(offer) } as unknown as StoreAdapter;
    const sink = { saveOffer: vi.fn() };
    expect(await processRefresh(job, { amazon: adapter }, sink)).toEqual({ status: "updated", offer });
    expect(sink.saveOffer).toHaveBeenCalledWith(1, offer);
  });
});
