import { describe, expect, it } from "vitest";
import { SAME_PRODUCT_THRESHOLD, extractAttributes, matchTitles } from "../matcher";

describe("extractAttributes", () => {
  it("parses Amazon-style titles", () => {
    expect(extractAttributes("Apple iPhone 15 (128 GB) - Black")).toEqual({
      brand: "apple",
      model: "iphone 15",
      storageGb: 128,
      ramGb: null,
      colour: "black",
    });
  });

  it("parses Flipkart-style titles with RAM", () => {
    expect(extractAttributes("SAMSUNG Galaxy S24 FE 5G (Blue, 256 GB) (8 GB RAM)")).toMatchObject({
      brand: "samsung",
      model: "galaxy s24 fe",
      storageGb: 256,
      ramGb: 8,
      colour: "blue",
    });
  });

  it("parses RAM/storage pairs and marketing colour names", () => {
    expect(extractAttributes("OnePlus 13R | Nebula Noir | 12GB/256GB")).toMatchObject({
      brand: "oneplus",
      ramGb: 12,
      storageGb: 256,
      colour: "black",
    });
    expect(extractAttributes("Redmi Note 14 Pro 5G (8GB+128GB)")).toMatchObject({ brand: "xiaomi", ramGb: 8, storageGb: 128 });
  });
});

describe("matchTitles", () => {
  it("matches the same variant across stores with high confidence", () => {
    const r = matchTitles("Apple iPhone 15 (128 GB) - Black", "Apple iPhone 15 (Black, 128 GB)");
    expect(r.decision).toBe("same");
    expect(r.confidence).toBeGreaterThanOrEqual(SAME_PRODUCT_THRESHOLD);
  });

  it("never matches different storage or colour", () => {
    expect(matchTitles("Apple iPhone 15 (128 GB) - Black", "Apple iPhone 15 (Black, 256 GB)").decision).toBe("different");
    expect(matchTitles("Apple iPhone 15 (128 GB) - Black", "Apple iPhone 15 (Blue, 128 GB)").decision).toBe("different");
    expect(
      matchTitles("Samsung Galaxy S24 FE 5G (8GB/128GB) Blue", "SAMSUNG Galaxy S24 FE 5G (Blue, 128 GB) (12 GB RAM)").decision,
    ).toBe("different");
  });

  it("does not treat a different model as the same product", () => {
    expect(matchTitles("Apple iPhone 15 (128 GB) - Black", "Apple iPhone 15 Plus (128 GB) - Black").decision).not.toBe("same");
    expect(matchTitles("Apple iPhone 15 (128 GB) - Black", "Samsung Galaxy S24 (128 GB) - Black").decision).toBe("different");
  });

  it("is only 'uncertain' when variant attributes are missing", () => {
    expect(matchTitles("Apple iPhone 15", "Apple iPhone 15 (Black, 128 GB)").decision).toBe("uncertain");
  });
});
