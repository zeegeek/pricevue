import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  AdapterNotConfiguredError,
  AmazonAdapter,
  CapabilityNotSupportedError,
  FlipkartAdapter,
  adapterForUrl,
  amazonConfigFromEnv,
  createAdapterRegistry,
  parseFlipkartProductHtml,
} from "../adapters";

const fixture = (name: string) => readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), "utf8");

describe("parseFlipkartProductHtml (fixtures, no live scraping)", () => {
  it("reads price, brand, seller and MRP from JSON-LD", () => {
    expect(parseFlipkartProductHtml(fixture("flipkart-product.html"))).toEqual({
      title: "Apple iPhone 15 (Black, 128 GB)",
      brand: "Apple",
      imageUrl: "https://rukminim2.flixcart.com/image/iphone15.jpeg",
      pricePaise: 6199900,
      mrpPaise: 6990000,
      inStock: true,
      seller: "Flipkart Retail",
    });
  });

  it("handles @graph and out-of-stock", () => {
    expect(parseFlipkartProductHtml(fixture("flipkart-out-of-stock.html"))).toMatchObject({
      brand: "OnePlus",
      pricePaise: 4299900,
      inStock: false,
    });
  });

  it("returns null when no product data exists", () => {
    expect(parseFlipkartProductHtml("<html><body>captcha</body></html>")).toBeNull();
  });
});

describe("FlipkartAdapter", () => {
  it("does not hit the network unless the scraper is enabled", async () => {
    const fetcher = vi.fn();
    const adapter = new FlipkartAdapter({ scraperEnabled: false }, fetcher);
    await expect(adapter.getOffer("MOBGTAGPTB3VS24W")).rejects.toBeInstanceOf(AdapterNotConfiguredError);
    await expect(adapter.search("iphone")).rejects.toBeInstanceOf(CapabilityNotSupportedError);
    expect(fetcher).not.toHaveBeenCalled();
    expect(adapter.capabilities.offer).toBe(false);
  });

  it("builds an offer from a (mocked) page fetch", async () => {
    const fetcher = vi.fn(async () => new Response(fixture("flipkart-product.html")));
    const adapter = new FlipkartAdapter({ scraperEnabled: true }, fetcher);
    const offer = await adapter.getOffer("MOBGTAGPTB3VS24W");
    expect(offer).toMatchObject({ store: "flipkart", listedPaise: 6199900, inStock: true, source: "scraper" });
  });
});

describe("AmazonAdapter (Creators API stub)", () => {
  it("reads credentials from env and reports when unconfigured", async () => {
    const adapter = new AmazonAdapter(amazonConfigFromEnv({}));
    expect(adapter.isConfigured()).toBe(false);
    expect(adapter.config.associateTag).toBe("pricevue-21");
    await expect(adapter.getOffer("B0CHX1W1XY")).rejects.toBeInstanceOf(AdapterNotConfiguredError);
  });

  it("is configured when both credentials are present", () => {
    const adapter = new AmazonAdapter(
      amazonConfigFromEnv({ AMAZON_CREATORS_API_CREDENTIAL_ID: "id", AMAZON_CREATORS_API_CREDENTIAL_SECRET: "s" }),
    );
    expect(adapter.isConfigured()).toBe(true);
  });
});

describe("adapter registry", () => {
  it("routes URLs to the right adapter", () => {
    const registry = createAdapterRegistry({});
    expect(adapterForUrl(registry, "https://www.amazon.in/dp/B0CHX1W1XY")?.id).toBe("amazon");
    expect(adapterForUrl(registry, "https://www.flipkart.com/a/p/itm6ac6485515ae4")?.id).toBe("flipkart");
    expect(adapterForUrl(registry, "https://www.myntra.com/1")).toBeNull();
  });
});
