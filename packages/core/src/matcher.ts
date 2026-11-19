/**
 * Variant-aware product matching. Two listings are only considered the *same product*
 * when brand + model agree and no variant attribute (storage, RAM, colour) conflicts.
 */

export interface ProductAttributes {
  brand: string | null;
  model: string | null;
  storageGb: number | null;
  ramGb: number | null;
  colour: string | null;
}

const BRANDS = [
  "apple",
  "samsung",
  "oneplus",
  "xiaomi",
  "redmi",
  "poco",
  "realme",
  "oppo",
  "vivo",
  "iqoo",
  "motorola",
  "google",
  "nothing",
  "nokia",
  "infinix",
  "tecno",
];

const BRAND_ALIASES: Record<string, string> = { iphone: "apple", pixel: "google", mi: "xiaomi" };

const COLOURS: Record<string, string> = {
  black: "black",
  midnight: "black",
  graphite: "black",
  "nebula noir": "black",
  "obsidian": "black",
  "titanium black": "black",
  blue: "blue",
  navy: "blue",
  "astral trail": "blue",
  green: "green",
  mint: "green",
  pink: "pink",
  rose: "pink",
  yellow: "yellow",
  white: "white",
  silver: "silver",
  gold: "gold",
  purple: "purple",
  lavender: "purple",
  grey: "grey",
  gray: "grey",
  red: "red",
};

const NOISE = new Set([
  "5g",
  "4g",
  "smartphone",
  "mobile",
  "phone",
  "with",
  "and",
  "the",
  "new",
  "dual",
  "sim",
  "ram",
  "rom",
  "storage",
  "gb",
  "tb",
  "|",
  "-",
]);

function normalise(title: string): string {
  return title
    .toLowerCase()
    .replace(/[()[\],|/+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCapacity(raw: string, unit: string): number {
  const n = Number(raw);
  return unit.toLowerCase() === "tb" ? n * 1024 : n;
}

export function extractAttributes(title: string): ProductAttributes {
  const t = normalise(title);
  let ramGb: number | null = null;
  let storageGb: number | null = null;

  // "8GB RAM", "8 GB RAM"
  const ramMatch = t.match(/(\d{1,2})\s?gb\s?ram/);
  if (ramMatch) ramGb = Number(ramMatch[1]);

  // "8/256", "8gb/256gb", "8 gb + 256 gb" (normalise turned / and + into spaces)
  const pair = title.toLowerCase().match(/(\d{1,2})\s?(?:gb)?\s?[/+]\s?(\d{2,4})\s?(gb|tb)?/);
  if (pair) {
    ramGb ??= Number(pair[1]);
    storageGb = parseCapacity(pair[2]!, pair[3] ?? "gb");
  }

  if (storageGb === null) {
    const caps = [...t.matchAll(/(\d{2,4}|\d)\s?(gb|tb)(?!\s?ram)/g)]
      .map((m) => parseCapacity(m[1]!, m[2]!))
      .filter((n) => n !== ramGb || n >= 32);
    const storage = caps.filter((n) => n >= 32);
    if (storage.length) storageGb = Math.max(...storage);
  }

  let brand: string | null = null;
  const words = t.split(" ");
  for (const w of words) {
    if (BRANDS.includes(w)) {
      brand = w === "redmi" || w === "poco" ? "xiaomi" : w;
      break;
    }
    if (BRAND_ALIASES[w]) {
      brand = BRAND_ALIASES[w]!;
      break;
    }
  }

  let colour: string | null = null;
  const colourKeys = Object.keys(COLOURS).sort((a, b) => b.length - a.length);
  for (const key of colourKeys) {
    if (new RegExp(`\\b${key}\\b`).test(t)) {
      colour = COLOURS[key]!;
      break;
    }
  }

  const model = extractModel(t, brand, colourKeys);
  return { brand, model, storageGb, ramGb, colour };
}

function extractModel(t: string, brand: string | null, colourKeys: string[]): string | null {
  let s = t;
  // Drop everything describing variants/colours so only the model name remains.
  s = s.replace(/\d{1,4}\s?(gb|tb)(\s?ram)?/g, " ");
  for (const key of colourKeys) s = s.replace(new RegExp(`\\b${key}\\b`, "g"), " ");
  const tokens = s
    .split(" ")
    .filter((w) => w && !NOISE.has(w))
    .filter((w) => w !== brand && BRAND_ALIASES[w] !== brand)
    .filter((w) => !(brand === "xiaomi" && w === "xiaomi"));
  if (t.includes("iphone") && !tokens.includes("iphone")) tokens.unshift("iphone");
  const model = tokens.slice(0, 4).join(" ").trim();
  return model || null;
}

export type MatchDecision = "same" | "different" | "uncertain";

export interface MatchResult {
  decision: MatchDecision;
  /** 0..1 */
  confidence: number;
  reasons: string[];
}

/** Only matches at or above this confidence are shown to users as the same product. */
export const SAME_PRODUCT_THRESHOLD = 0.9;

function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(" "));
  const tb = new Set(b.split(" "));
  const inter = [...ta].filter((x) => tb.has(x)).length;
  return inter / Math.max(ta.size, tb.size);
}

export function matchProducts(a: ProductAttributes, b: ProductAttributes): MatchResult {
  const reasons: string[] = [];

  if (a.brand && b.brand && a.brand !== b.brand) {
    return { decision: "different", confidence: 0, reasons: ["brand mismatch"] };
  }
  for (const key of ["storageGb", "ramGb", "colour"] as const) {
    if (a[key] !== null && b[key] !== null && a[key] !== b[key]) {
      return { decision: "different", confidence: 0, reasons: [`${key} mismatch`] };
    }
  }

  let confidence = 0;
  if (a.brand && a.brand === b.brand) {
    confidence += 0.2;
    reasons.push("brand");
  }
  if (a.model && b.model) {
    const sim = tokenSimilarity(a.model, b.model);
    if (sim === 1) {
      confidence += 0.5;
      reasons.push("model exact");
    } else {
      confidence += 0.5 * sim * 0.6;
      reasons.push(`model ~${sim.toFixed(2)}`);
    }
  }
  for (const key of ["storageGb", "ramGb", "colour"] as const) {
    if (a[key] !== null && a[key] === b[key]) {
      confidence += key === "ramGb" ? 0.05 : 0.125;
      reasons.push(key);
    } else if (a[key] === null || b[key] === null) {
      reasons.push(`${key} unknown`);
    }
  }
  // RAM is often omitted for iPhones; don't penalise when both sides omit it.
  if (a.ramGb === null && b.ramGb === null) confidence += 0.05;

  confidence = Math.min(1, Number(confidence.toFixed(3)));
  const decision: MatchDecision =
    confidence >= SAME_PRODUCT_THRESHOLD ? "same" : confidence < 0.5 ? "different" : "uncertain";
  return { decision, confidence, reasons };
}

export function matchTitles(a: string, b: string): MatchResult {
  return matchProducts(extractAttributes(a), extractAttributes(b));
}
