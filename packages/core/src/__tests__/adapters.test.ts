import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  AMAZON_OFFER_MAX_AGE_MS,
  AdapterNotConfiguredError,
  AmazonAdapter,
  AmazonCreatorsApiClient,
  CapabilityNotSupportedError,
  FlipkartAdapter,
  adapterForUrl,
  amazonConfigFromEnv,
  createAdapterRegistry,
  parseFlipkartProductHtml,
} from "../adapters";

const fixture = (name: string) =>
  readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), "utf8");

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

  it("falls back to embedded __INITIAL_STATE__ for price and MRP", () => {
    expect(parseFlipkartProductHtml(fixture("flipkart-embedded-state.html"))).toEqual({
      title: "Samsung Galaxy S24 FE (Mint, 128 GB) (8 GB RAM)",
      imageUrl: "https://rukminim2.flixcart.com/image/s24fe.jpeg",
      pricePaise: 3599900,
      mrpPaise: 5999900,
      inStock: true,
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
    await expect(adapter.getOffer("MOBGTAGPTB3VS24W")).rejects.toBeInstanceOf(
      AdapterNotConfiguredError,
    );
    await expect(adapter.search("iphone")).rejects.toBeInstanceOf(CapabilityNotSupportedError);
    expect(fetcher).not.toHaveBeenCalled();
    expect(adapter.capabilities.offer).toBe(false);
  });

  it("builds an offer from a (mocked) page fetch", async () => {
    const fetcher = vi.fn(async () => new Response(fixture("flipkart-product.html")));
    const adapter = new FlipkartAdapter({ scraperEnabled: true }, fetcher);
    const offer = await adapter.getOffer("MOBGTAGPTB3VS24W", {
      url: "https://www.flipkart.com/apple-iphone-15/p/itm6ac6485515ae4?pid=MOBGTAGPTB3VS24W&lid=x",
    });
    expect(offer).toMatchObject({
      store: "flipkart",
      listedPaise: 6199900,
      inStock: true,
      source: "scraper",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://www.flipkart.com/apple-iphone-15/p/itm6ac6485515ae4?pid=MOBGTAGPTB3VS24W",
      expect.anything(),
    );
  });
});

describe("AmazonAdapter (Creators API)", () => {
  const env = {
    AMAZON_CREATORS_API_CREDENTIAL_ID: "id",
    AMAZON_CREATORS_API_CREDENTIAL_SECRET: "s",
  };
  const apiFetcher = (body: string) =>
    vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes("/auth/o2/token")
        ? Response.json({ access_token: "tok", token_type: "bearer", expires_in: 3600 })
        : new Response(body, { headers: { "content-type": "application/json" } }),
    );

  it("reports 'Amazon API not configured' without credentials and makes no requests", async () => {
    const fetcher = vi.fn();
    const adapter = new AmazonAdapter(amazonConfigFromEnv({}), fetcher);
    expect(adapter.isConfigured()).toBe(false);
    expect(adapter.config.associateTag).toBe("pricevue-21");
    const err = adapter.getOffer("B0CHX1W1XY");
    await expect(err).rejects.toBeInstanceOf(AdapterNotConfiguredError);
    await expect(err).rejects.toThrow(/Amazon API not configured/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("authenticates via LwA (EU, v3.2) and calls GetItems with tag and marketplace", async () => {
    const fetcher = apiFetcher(fixture("amazon-getitems.json"));
    await new AmazonAdapter(amazonConfigFromEnv(env), fetcher).getOffer("B0CHX1W1XY");
    const [tokenUrl, tokenInit] = fetcher.mock.calls[0]!;
    expect(tokenUrl).toBe("https://api.amazon.co.uk/auth/o2/token");
    expect(JSON.parse(String(tokenInit?.body))).toMatchObject({
      client_id: "id",
      scope: "creatorsapi::default",
    });
    const [url, init] = fetcher.mock.calls[1]!;
    expect(url).toBe("https://creatorsapi.amazon/catalog/v1/getItems");
    expect(init?.headers).toMatchObject({
      authorization: "Bearer tok",
      "x-marketplace": "www.amazon.in",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      itemIds: ["B0CHX1W1XY"],
      partnerTag: "pricevue-21",
      marketplace: "www.amazon.in",
    });
  });

  it("maps price, MRP, stock, title and image from the fixture", async () => {
    const adapter = new AmazonAdapter(
      amazonConfigFromEnv(env),
      apiFetcher(fixture("amazon-getitems.json")),
    );
    expect(await adapter.getOffer("B0CHX1W1XY")).toMatchObject({
      store: "amazon",
      listedPaise: 6_199_900,
      mrpPaise: 6_990_000,
      inStock: true,
      seller: "Appario Retail Private Ltd",
      source: "api",
    });
    expect(await adapter.getListing("B0CHX1W1XY")).toEqual({
      store: "amazon",
      externalId: "B0CHX1W1XY",
      title: "Apple iPhone 15 (128 GB) - Black",
      brand: "Apple",
      url: "https://www.amazon.in/dp/B0CHX1W1XY?tag=pricevue-21",
      imageUrl: "https://m.media-amazon.com/images/I/71d7rfSl0wL._SL500_.jpg",
    });
  });

  it("maps out-of-stock items and missing ASINs", async () => {
    const adapter = new AmazonAdapter(
      amazonConfigFromEnv(env),
      apiFetcher(fixture("amazon-getitems-out-of-stock.json")),
    );
    expect(await adapter.getOffer("B0D1XD1ZV3")).toMatchObject({
      listedPaise: 2_499_900,
      inStock: false,
    });
    expect(await adapter.getListing("B0D1XD1ZV3")).toMatchObject({
      imageUrl: "https://m.media-amazon.com/images/I/61abc._SL160_.jpg",
    });
    expect(await adapter.getOffer("B0000000XX")).toBeNull();
  });

  it("caches offers for at most one hour", async () => {
    let now = 0;
    const fetcher = apiFetcher(fixture("amazon-getitems.json"));
    const client = new AmazonCreatorsApiClient(amazonConfigFromEnv(env), fetcher, () => now);
    await client.getItems(["B0CHX1W1XY"]);
    now = AMAZON_OFFER_MAX_AGE_MS - 1;
    await client.getItems(["B0CHX1W1XY"]);
    expect(fetcher).toHaveBeenCalledTimes(2); // token + one GetItems
    now = AMAZON_OFFER_MAX_AGE_MS;
    await client.getItems(["B0CHX1W1XY"]);
    expect(fetcher.mock.calls.filter(([u]) => u.includes("getItems"))).toHaveLength(2);
  });
});

describe("adapter registry", () => {
  it("routes URLs to the right adapter", () => {
    const registry = createAdapterRegistry({});
    expect(adapterForUrl(registry, "https://www.amazon.in/dp/B0CHX1W1XY")?.id).toBe("amazon");
    expect(adapterForUrl(registry, "https://www.flipkart.com/a/p/itm6ac6485515ae4")?.id).toBe(
      "flipkart",
    );
    expect(adapterForUrl(registry, "https://www.myntra.com/1")).toBeNull();
  });
});
