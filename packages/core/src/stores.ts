export const STORE_IDS = ["amazon", "flipkart", "myntra", "ajio", "croma"] as const;
export type StoreId = (typeof STORE_IDS)[number];

export interface StoreMeta {
  id: StoreId;
  name: string;
  shortName: string;
  /** Tile background (white text/mark on it passes AA). */
  bg: string;
  /** Logo mark colour on the tile. */
  mark: string;
  letter: string;
  /** Line colour used in charts. */
  line: string;
  /** Whether the store is live in the current release. */
  live: boolean;
}

export const STORES: Record<StoreId, StoreMeta> = {
  amazon: {
    id: "amazon",
    name: "Amazon.in",
    shortName: "Amazon",
    bg: "#232F3E",
    mark: "#FF9900",
    letter: "a",
    line: "#F59E0B",
    live: true,
  },
  flipkart: {
    id: "flipkart",
    name: "Flipkart",
    shortName: "Flipkart",
    bg: "#2874F0",
    mark: "#FFE11B",
    letter: "F",
    line: "#2874F0",
    live: true,
  },
  myntra: {
    id: "myntra",
    name: "Myntra",
    shortName: "Myntra",
    bg: "#C81E5A",
    mark: "#FFFFFF",
    letter: "M",
    line: "#E4366F",
    live: false,
  },
  ajio: {
    id: "ajio",
    name: "Ajio",
    shortName: "Ajio",
    bg: "#2C4152",
    mark: "#FFFFFF",
    letter: "A",
    line: "#64748B",
    live: false,
  },
  croma: {
    id: "croma",
    name: "Croma",
    shortName: "Croma",
    bg: "#0F7D7E",
    mark: "#FFFFFF",
    letter: "C",
    line: "#0F9D9E",
    live: false,
  },
};

export function isStoreId(value: string): value is StoreId {
  return (STORE_IDS as readonly string[]).includes(value);
}
