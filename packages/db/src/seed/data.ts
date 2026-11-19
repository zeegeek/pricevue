import type { StoreId } from "@pricevue/core";

export interface SeedVariant {
  storageGb: number;
  ramGb: number;
  colour: string;
  colourHex: string;
  /** Launch MRP in rupees. */
  mrp: number;
  /** Today's typical selling price in rupees. */
  price: number;
  stores: StoreId[];
}

export interface SeedProduct {
  slug: string;
  brand: string;
  modelName: string;
  /** Days ago the product launched (history starts no earlier). */
  launchedDaysAgo: number;
  specs: Record<string, string>;
  variants: SeedVariant[];
}

const both: StoreId[] = ["amazon", "flipkart"];

export const SEED_BRANDS = ["Apple", "Samsung", "OnePlus", "Xiaomi", "Google", "Nothing"];

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: "apple-iphone-15",
    brand: "Apple",
    modelName: "iPhone 15",
    launchedDaysAgo: 420,
    specs: { Display: '6.1" Super Retina XDR', Chip: "A16 Bionic", Camera: "48 MP + 12 MP", Battery: "3349 mAh" },
    variants: [
      { storageGb: 128, ramGb: 6, colour: "Black", colourHex: "#3B3B3F", mrp: 69900, price: 59999, stores: both },
      { storageGb: 128, ramGb: 6, colour: "Blue", colourHex: "#A9C3D6", mrp: 69900, price: 60499, stores: both },
      { storageGb: 128, ramGb: 6, colour: "Pink", colourHex: "#F3C9D2", mrp: 69900, price: 60999, stores: both },
      { storageGb: 256, ramGb: 6, colour: "Black", colourHex: "#3B3B3F", mrp: 79900, price: 69999, stores: both },
      { storageGb: 256, ramGb: 6, colour: "Blue", colourHex: "#A9C3D6", mrp: 79900, price: 70499, stores: ["flipkart"] },
      { storageGb: 512, ramGb: 6, colour: "Black", colourHex: "#3B3B3F", mrp: 99900, price: 89999, stores: ["amazon"] },
    ],
  },
  {
    slug: "apple-iphone-16",
    brand: "Apple",
    modelName: "iPhone 16",
    launchedDaysAgo: 420,
    specs: { Display: '6.1" Super Retina XDR', Chip: "A18", Camera: "48 MP Fusion + 12 MP", Battery: "3561 mAh" },
    variants: [
      { storageGb: 128, ramGb: 8, colour: "Ultramarine", colourHex: "#5B6FD8", mrp: 79900, price: 69900, stores: both },
      { storageGb: 128, ramGb: 8, colour: "Teal", colourHex: "#7FB9B0", mrp: 79900, price: 70900, stores: both },
      { storageGb: 256, ramGb: 8, colour: "Ultramarine", colourHex: "#5B6FD8", mrp: 89900, price: 79900, stores: both },
    ],
  },
  {
    slug: "samsung-galaxy-s24-fe",
    brand: "Samsung",
    modelName: "Galaxy S24 FE",
    launchedDaysAgo: 400,
    specs: { Display: '6.7" Dynamic AMOLED 2X', Chip: "Exynos 2400e", Camera: "50 MP + 12 MP + 8 MP", Battery: "4700 mAh" },
    variants: [
      { storageGb: 128, ramGb: 8, colour: "Mint", colourHex: "#BFE3CF", mrp: 59999, price: 34999, stores: both },
      { storageGb: 256, ramGb: 8, colour: "Graphite", colourHex: "#4A4D55", mrp: 65999, price: 39999, stores: both },
    ],
  },
  {
    slug: "oneplus-13r",
    brand: "OnePlus",
    modelName: "13R",
    launchedDaysAgo: 320,
    specs: { Display: '6.78" LTPO AMOLED', Chip: "Snapdragon 8 Gen 3", Camera: "50 MP + 50 MP + 8 MP", Battery: "6000 mAh" },
    variants: [
      { storageGb: 256, ramGb: 12, colour: "Nebula Noir", colourHex: "#2B2D3A", mrp: 42999, price: 39999, stores: both },
      { storageGb: 512, ramGb: 16, colour: "Astral Trail", colourHex: "#D9D4CB", mrp: 49999, price: 45999, stores: ["amazon"] },
    ],
  },
  {
    slug: "xiaomi-redmi-note-14-pro",
    brand: "Xiaomi",
    modelName: "Redmi Note 14 Pro",
    launchedDaysAgo: 330,
    specs: { Display: '6.67" AMOLED 120Hz', Chip: "Dimensity 7300 Ultra", Camera: "50 MP OIS", Battery: "5500 mAh" },
    variants: [
      { storageGb: 128, ramGb: 8, colour: "Titan Black", colourHex: "#26272B", mrp: 26999, price: 22999, stores: both },
      { storageGb: 256, ramGb: 8, colour: "Phantom Purple", colourHex: "#8E7CC3", mrp: 28999, price: 24999, stores: both },
    ],
  },
  {
    slug: "google-pixel-9",
    brand: "Google",
    modelName: "Pixel 9",
    launchedDaysAgo: 450,
    specs: { Display: '6.3" Actua OLED', Chip: "Tensor G4", Camera: "50 MP + 48 MP", Battery: "4700 mAh" },
    variants: [
      { storageGb: 256, ramGb: 12, colour: "Obsidian", colourHex: "#2E2F33", mrp: 79999, price: 64999, stores: ["flipkart"] },
      { storageGb: 256, ramGb: 12, colour: "Peony", colourHex: "#F2B8C6", mrp: 79999, price: 65999, stores: ["flipkart"] },
    ],
  },
  {
    slug: "nothing-phone-3a",
    brand: "Nothing",
    modelName: "Phone (3a)",
    launchedDaysAgo: 250,
    specs: { Display: '6.77" Flexible AMOLED', Chip: "Snapdragon 7s Gen 3", Camera: "50 MP + 50 MP tele", Battery: "5000 mAh" },
    variants: [
      { storageGb: 128, ramGb: 8, colour: "White", colourHex: "#EDEDED", mrp: 24999, price: 22999, stores: ["flipkart"] },
      { storageGb: 256, ramGb: 8, colour: "Black", colourHex: "#1E1E1E", mrp: 26999, price: 24999, stores: ["flipkart"] },
    ],
  },
];

/** Big Indian sale windows as [daysAgo start, daysAgo end, discount factor]. */
export const SALE_WINDOWS: Array<[number, number, number]> = [
  [52, 44, 0.9], // Diwali / Great Indian Festival / Big Billion Days
  [130, 127, 0.94], // Prime Day / Flipkart GOAT sale
  [305, 300, 0.93], // Republic Day sale
];
