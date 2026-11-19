import { describe, expect, it } from "vitest";
import { SAME_PRODUCT_THRESHOLD, extractAttributes, matchProducts, matchTitles, type MatchDecision } from "../matcher";

describe("extractAttributes", () => {
  it.each([
    ["Apple iPhone 15 (128 GB) - Black", { brand: "apple", model: "iphone 15", storageGb: 128, ramGb: null, colour: "black" }],
    [
      "SAMSUNG Galaxy S24 FE 5G (Blue, 256 GB) (8 GB RAM)",
      { brand: "samsung", model: "galaxy s24 fe", storageGb: 256, ramGb: 8, colour: "blue" },
    ],
    ["OnePlus 13R | Nebula Noir | 12GB/256GB", { brand: "oneplus", model: "13r", ramGb: 12, storageGb: 256, colour: "black" }],
    ["Redmi Note 14 Pro 5G (8GB+128GB)", { brand: "xiaomi", model: "redmi note 14 pro", ramGb: 8, storageGb: 128 }],
    ["REDMI Note 13 Pro+ 5G (Fusion Purple, 256 GB)", { model: "redmi note 13 pro plus", colour: "purple" }],
    [
      "Samsung Galaxy S24 Ultra 5G AI Smartphone (Titanium Gray, 12GB, 256GB Storage)",
      { model: "galaxy s24 ultra", ramGb: 12, storageGb: 256, colour: "grey" },
    ],
    [
      "Samsung Galaxy M35 5G (Moonlight Blue,6GB RAM,128GB Storage)| Upto 12GB RAM with RAM Plus | Expandable upto 1TB",
      { ramGb: 6, storageGb: 128, colour: "blue" },
    ],
    ["Apple iPhone 16 Pro Max 1TB Desert Titanium", { model: "iphone 16 pro max", storageGb: 1024, colour: "desert titanium" }],
    ["Nothing Phone (3a) 5G (White, 8GB RAM, 256GB)", { brand: "nothing", model: "3a", colour: "white" }],
    ["Moto Edge 50 Fusion (Forest Blue, 128 GB) (8 GB RAM)", { brand: "motorola", model: "edge 50 fusion" }],
    ["Apple iPhone 13 (128GB) - Midnight (Renewed)", { model: "iphone 13", colour: "black", storageGb: 128 }],
    ["Google Pixel 9 (Peony, 256 GB) (12 GB RAM)", { brand: "google", model: "pixel 9", colour: "peony" }],
  ])("%s", (title, expected) => {
    expect(extractAttributes(title)).toMatchObject(expected);
  });

  it("falls back to the adapter brand and normalises identifiers", () => {
    expect(
      extractAttributes("Galaxy Z Flip6 (Silver, 256 GB)", { brand: "SAMSUNG", gtin: "0 8806095 467894", mpn: "sm-f741b" }),
    ).toMatchObject({ brand: "samsung", gtin: "08806095467894".replace(/^0/, ""), mpn: "SMF741B" });
  });
});

const AMZ_15 = "Apple iPhone 15 (128 GB) - Black";

describe("matchTitles", () => {
  it.each<[string, string, MatchDecision]>([
    // same variant, different store formatting
    [AMZ_15, "Apple iPhone 15 (Black, 128 GB)", "same"],
    ["Apple iPhone 13 (128GB) - Midnight (Renewed)", "Apple iPhone 13 (Midnight, 128 GB)", "same"],
    [
      "Samsung Galaxy S24 Ultra 5G AI Smartphone (Titanium Gray, 12GB, 256GB Storage)",
      "SAMSUNG Galaxy S24 Ultra 5G (Titanium Gray, 256 GB) (12 GB RAM)",
      "same",
    ],
    ["OnePlus Nord CE4 Lite 5G (Super Silver, 8GB RAM, 128GB Storage)", "OnePlus Nord CE 4 Lite 5G (Super Silver, 128 GB) (8 GB RAM)", "same"],
    ["Moto Edge 50 Fusion (Forest Blue, 8GB/128GB)", "Motorola Edge 50 Fusion (Forest Blue, 128 GB) (8 GB RAM)", "same"],
    ["Apple iPhone 16 Pro Max 1TB Desert Titanium", "Apple iPhone 16 Pro Max (Desert Titanium, 1 TB)", "same"],
    // near-misses: variant conflicts
    [AMZ_15, "Apple iPhone 15 (Black, 256 GB)", "different"],
    [AMZ_15, "Apple iPhone 15 (Blue, 128 GB)", "different"],
    ["Samsung Galaxy S24 FE 5G (8GB/128GB) Blue", "SAMSUNG Galaxy S24 FE 5G (Blue, 128 GB) (12 GB RAM)", "different"],
    ["Apple iPhone 16 Pro Max 256GB Natural Titanium", "Apple iPhone 16 Pro Max (Desert Titanium, 256 GB)", "different"],
    // near-misses: sibling models
    [AMZ_15, "Apple iPhone 15 Plus (128 GB) - Black", "different"],
    [AMZ_15, "Apple iPhone 14 (128 GB) - Black", "different"],
    ["OnePlus 13 (Black Eclipse, 12GB RAM, 256GB)", "OnePlus 13R (Black Eclipse, 256 GB) (12 GB RAM)", "different"],
    ["Redmi Note 13 Pro 5G (Arctic White, 8GB, 256GB)", "REDMI Note 13 Pro+ 5G (Arctic White, 256 GB) (8 GB RAM)", "different"],
    ["Google Pixel 8 (Obsidian, 128 GB) (8 GB RAM)", "Google Pixel 8a (Obsidian, 128 GB) (8 GB RAM)", "different"],
    ["Samsung Galaxy S24 (Onyx Black, 8GB, 256GB)", "SAMSUNG Galaxy S24 FE 5G (Onyx Black, 256 GB) (8 GB RAM)", "different"],
    [AMZ_15, "Samsung Galaxy S24 (128 GB) - Black", "different"],
    // missing variant info -> review, never auto-link
    ["Apple iPhone 15", "Apple iPhone 15 (Black, 128 GB)", "uncertain"],
    ["Redmi Note 13 5G (Arctic White, 128GB)", "REDMI Note 13 5G (Arctic White, 128 GB) (6 GB RAM)", "uncertain"],
  ])("%s ~ %s → %s", (a, b, decision) => {
    const r = matchTitles(a, b);
    expect(r.decision, r.reasons.join(", ")).toBe(decision);
    if (decision === "same") expect(r.confidence).toBeGreaterThanOrEqual(SAME_PRODUCT_THRESHOLD);
  });

  it("links on a shared GTIN even when titles are sparse, but never across a storage conflict", () => {
    const a = extractAttributes("Galaxy Z Flip6", { brand: "Samsung", gtin: "8806095467894" });
    const b = extractAttributes("Samsung Galaxy Z Flip6 5G (Silver Shadow, 256 GB) (12 GB RAM)", { gtin: "8806095467894" });
    expect(matchProducts(a, b)).toMatchObject({ decision: "same", confidence: 1, reasons: ["gtin"] });
    const c = extractAttributes("Samsung Galaxy Z Flip6 (512 GB)", { gtin: "8806095467894" });
    expect(matchProducts(c, b).decision).toBe("different");
  });
});
