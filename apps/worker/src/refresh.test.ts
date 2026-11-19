import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { FlipkartAdapter, createAdapterRegistry, type StoreAdapter } from "@pricevue/core";
import { processRefresh } from "./refresh";

const job = {
  listingId: 1,
  storeId: "amazon" as const,
  externalId: "B0CHX1W1XY",
  url: "https://www.amazon.in/dp/B0CHX1W1XY",
};

describe("processRefresh", () => {
  it("skips unconfigured adapters instead of failing", async () => {
    const sink = { saveOffer: vi.fn() };
    const result = await processRefresh(job, createAdapterRegistry({}), sink);
    expect(result.status).toBe("skipped");
    expect(sink.saveOffer).not.toHaveBeenCalled();
  });

  it("saves offers returned by the adapter", async () => {
    const offer = {
      store: "amazon" as const,
      externalId: job.externalId,
      listedPaise: 5_999_900,
      shippingPaise: 0,
      inStock: true,
      capturedAt: new Date(),
      source: "fixture" as const,
    };
    const adapter = { getOffer: vi.fn().mockResolvedValue(offer) } as unknown as StoreAdapter;
    const sink = { saveOffer: vi.fn() };
    expect(await processRefresh(job, { amazon: adapter }, sink)).toEqual({
      status: "updated",
      offer,
    });
    expect(sink.saveOffer).toHaveBeenCalledWith(1, offer);
    expect(adapter.getOffer).toHaveBeenCalledWith(job.externalId, { url: job.url });
  });

  it("writes a Flipkart snapshot parsed from the fetched page", async () => {
    const html = readFileSync(
      new URL("../../../packages/core/src/__fixtures__/flipkart-product.html", import.meta.url),
      "utf8",
    );
    const adapter = new FlipkartAdapter({ scraperEnabled: true }, async () => new Response(html));
    const sink = { saveOffer: vi.fn() };
    const fkJob = {
      listingId: 7,
      storeId: "flipkart" as const,
      externalId: "MOBGTAGPTB3VS24W",
      url: "https://www.flipkart.com/a/p/itm6ac6485515ae4?pid=MOBGTAGPTB3VS24W",
    };
    expect((await processRefresh(fkJob, { flipkart: adapter }, sink)).status).toBe("updated");
    expect(sink.saveOffer).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ listedPaise: 6199900, mrpPaise: 6990000 }),
    );
  });
});
