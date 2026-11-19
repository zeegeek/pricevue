import { describe, expect, it } from "vitest";
import { affiliateConfigFromEnv, buildAffiliateUrl, withAmazonTag } from "../affiliate";

describe("Amazon affiliate links", () => {
  it("adds tag=pricevue-21 to ASINs and URLs", () => {
    expect(withAmazonTag("B0CHX1W1XY")).toBe("https://www.amazon.in/dp/B0CHX1W1XY?tag=pricevue-21");
    expect(withAmazonTag("https://www.amazon.in/dp/B0CHX1W1XY?psc=1")).toBe(
      "https://www.amazon.in/dp/B0CHX1W1XY?psc=1&tag=pricevue-21",
    );
  });

  it("replaces any existing third-party tag and attribution params", () => {
    const url = new URL(withAmazonTag("https://www.amazon.in/dp/B0CHX1W1XY?tag=someone-21&ascsubtag=x&linkCode=ll1"));
    expect(url.searchParams.getAll("tag")).toEqual(["pricevue-21"]);
    expect(url.searchParams.has("ascsubtag")).toBe(false);
    expect(url.searchParams.has("linkCode")).toBe(false);
  });

  it("defaults to pricevue-21 when env is empty", () => {
    expect(affiliateConfigFromEnv({}).amazonTag).toBe("pricevue-21");
    const url = buildAffiliateUrl("amazon", "https://www.amazon.in/dp/B0CHX1W1XY", affiliateConfigFromEnv({ AMAZON_ASSOCIATE_TAG: "" }));
    expect(new URL(url).searchParams.get("tag")).toBe("pricevue-21");
  });
});

describe("Flipkart affiliate links", () => {
  it("adds affid only when configured", () => {
    const base = "https://www.flipkart.com/a/p/itm6ac6485515ae4?pid=MOBGTAGPTB3VS24W";
    expect(buildAffiliateUrl("flipkart", base)).toBe(base);
    expect(new URL(buildAffiliateUrl("flipkart", base, { flipkartAffiliateId: "pv123" })).searchParams.get("affid")).toBe("pv123");
  });
});
