import { describe, expect, it } from "vitest";
import { looksLikeUrl, parseAmazonUrl, parseFlipkartUrl, parseProductUrl } from "../url";

describe("parseAmazonUrl", () => {
  it.each([
    ["https://www.amazon.in/Apple-iPhone-15-128-GB/dp/B0CHX1W1XY/ref=sr_1_1?crid=X&tag=other-21", "B0CHX1W1XY"],
    ["https://www.amazon.in/dp/b0chx1w1xy", "B0CHX1W1XY"],
    ["amazon.in/gp/product/B0CHX1W1XY?psc=1", "B0CHX1W1XY"],
    ["https://m.amazon.in/gp/aw/d/B0CHX1W1XY", "B0CHX1W1XY"],
    ["https://www.amazon.in/product-reviews/B0CHX1W1XY/", "B0CHX1W1XY"],
    ["https://www.amazon.in/gp/offer-listing/B0CHX1W1XY", "B0CHX1W1XY"],
    ["https://www.amazon.in/s?k=iphone&asin=B0CHX1W1XY", "B0CHX1W1XY"],
  ])("extracts ASIN from %s", (url, asin) => {
    const r = parseAmazonUrl(url);
    expect(r).toMatchObject({ ok: true, store: "amazon", externalId: asin, idType: "asin" });
    if (r.ok && "canonicalUrl" in r) expect(r.canonicalUrl).toBe(`https://www.amazon.in/dp/${asin}`);
  });

  it("flags short links for server-side resolution", () => {
    expect(parseAmazonUrl("https://amzn.in/d/abc123")).toMatchObject({ ok: true, needsResolution: true });
    expect(parseAmazonUrl("https://amzn.to/3xYz")).toMatchObject({ ok: true, needsResolution: true });
  });

  it("rejects other marketplaces and look-alike hosts", () => {
    expect(parseAmazonUrl("https://www.amazon.com/dp/B0CHX1W1XY")).toEqual({ ok: false, reason: "unsupported_store" });
    expect(parseAmazonUrl("https://amazon.in.evil.com/dp/B0CHX1W1XY")).toEqual({ ok: false, reason: "unsupported_store" });
  });

  it("rejects non-product pages and garbage", () => {
    expect(parseAmazonUrl("https://www.amazon.in/s?k=iphone")).toEqual({ ok: false, reason: "not_a_product_url" });
    expect(parseAmazonUrl("https://www.amazon.in/dp/B0CHX1")).toEqual({ ok: false, reason: "not_a_product_url" });
    expect(parseAmazonUrl("")).toEqual({ ok: false, reason: "invalid_url" });
    expect(parseAmazonUrl("javascript:alert(1)")).toEqual({ ok: false, reason: "invalid_url" });
  });
});

describe("parseFlipkartUrl", () => {
  it("prefers the FSN pid when present", () => {
    const r = parseFlipkartUrl(
      "https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4?pid=MOBGTAGPTB3VS24W&lid=LSTMOB&marketplace=FLIPKART",
    );
    expect(r).toEqual({
      ok: true,
      store: "flipkart",
      externalId: "MOBGTAGPTB3VS24W",
      idType: "fsn",
      canonicalUrl: "https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4?pid=MOBGTAGPTB3VS24W",
    });
  });

  it("falls back to the itm id", () => {
    expect(parseFlipkartUrl("https://www.flipkart.com/apple-iphone-15/p/itm6ac6485515ae4")).toMatchObject({
      ok: true,
      externalId: "itm6ac6485515ae4",
      idType: "itm",
    });
  });

  it("handles app deep links and mobile hosts", () => {
    expect(
      parseFlipkartUrl("https://dl.flipkart.com/dl/apple-iphone-15/p/itm6ac6485515ae4?pid=MOBGTAGPTB3VS24W"),
    ).toMatchObject({ ok: true, externalId: "MOBGTAGPTB3VS24W" });
    expect(parseFlipkartUrl("https://m.flipkart.com/x/p/itm6ac6485515ae4")).toMatchObject({ ok: true });
  });

  it("ignores malformed pids and non-product pages", () => {
    expect(parseFlipkartUrl("https://www.flipkart.com/x/p/itm6ac6485515ae4?pid=bad")).toMatchObject({ idType: "itm" });
    expect(parseFlipkartUrl("https://www.flipkart.com/search?q=iphone")).toEqual({ ok: false, reason: "not_a_product_url" });
    expect(parseFlipkartUrl("https://fkrt.it/abc")).toMatchObject({ ok: true, needsResolution: true });
  });
});

describe("parseProductUrl", () => {
  it("dispatches by store and reports unsupported stores", () => {
    expect(parseProductUrl("https://www.amazon.in/dp/B0CHX1W1XY")).toMatchObject({ store: "amazon" });
    expect(parseProductUrl("https://www.flipkart.com/a/p/itm6ac6485515ae4")).toMatchObject({ store: "flipkart" });
    expect(parseProductUrl("https://www.myntra.com/12345")).toEqual({ ok: false, reason: "unsupported_store" });
    expect(parseProductUrl("iphone 15")).toEqual({ ok: false, reason: "invalid_url" });
  });

  it("distinguishes URLs from product names", () => {
    expect(looksLikeUrl("https://www.amazon.in/dp/B0CHX1W1XY")).toBe(true);
    expect(looksLikeUrl("flipkart.com/apple/p/itm123")).toBe(true);
    expect(looksLikeUrl("iPhone 15 128GB")).toBe(false);
    expect(looksLikeUrl("galaxy s24 fe")).toBe(false);
  });
});
