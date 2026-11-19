/**
 * Variant-aware product matching. Two listings are only considered the *same variant*
 * when brand + model agree and no variant attribute (storage, RAM, colour) conflicts.
 * Shared identifiers (EAN/GTIN, manufacturer part number) raise confidence to 1.
 */

export interface ProductAttributes {
  brand: string | null;
  model: string | null;
  storageGb: number | null;
  ramGb: number | null;
  colour: string | null;
  gtin?: string | null;
  mpn?: string | null;
}

export interface ListingIdentifiers {
  brand?: string | null;
  gtin?: string | null;
  mpn?: string | null;
}

const BRANDS = [
  "apple",
  "samsung",
  "oneplus",
  "xiaomi",
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
  "honor",
  "lava",
];

const BRAND_ALIASES: Record<string, string> = {
  iphone: "apple",
  pixel: "google",
  galaxy: "samsung",
  mi: "xiaomi",
  redmi: "xiaomi",
  poco: "xiaomi",
  moto: "motorola",
  narzo: "realme",
};
/** Aliases that carry no model information and are dropped from the model name. */
const PURE_BRAND_ALIASES = new Set(["moto"]);

const COLOURS: Record<string, string> = {
  black: "black",
  midnight: "black",
  graphite: "black",
  "nebula noir": "black",
  obsidian: "black",
  "titan black": "black",
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
  starlight: "white",
  silver: "silver",
  gold: "gold",
  purple: "purple",
  lavender: "purple",
  grey: "grey",
  gray: "grey",
  red: "red",
  "desert titanium": "desert titanium",
  "natural titanium": "natural titanium",
  "white titanium": "white titanium",
  "black titanium": "black titanium",
};
const COLOUR_KEYS = Object.keys(COLOURS).sort((a, b) => b.length - a.length);

const NOISE = new Set([
  "5g",
  "4g",
  "ai",
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
  "renewed",
  "refurbished",
  "unboxed",
  "-",
]);

/** Model tokens that denote a *different* model, e.g. iPhone 15 vs 15 Plus, 13 vs 13R. */
const MODEL_SUFFIXES = new Set([
  "plus",
  "pro",
  "max",
  "ultra",
  "fe",
  "lite",
  "mini",
  "neo",
  "prime",
  "fold",
  "flip",
  "power",
  "play",
  "a",
  "e",
  "r",
  "s",
  "t",
  "x",
]);

function normalise(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(\s*(renewed|refurbished|unboxed)\s*\)/g, " ")
    .replace(/([a-z])\+(?![\d])/g, "$1 plus")
    .replace(/\((\d+[a-z]?)\)/g, " $1 ") // Nothing "Phone (3a)"
    .replace(/\b(?:expandable\s+)?(?:up\s?to|expandable)\s*\d+\s?(?:gb|tb)(?:\s?ram)?/g, " ")
    .replace(/\d+\s?gb\s+(?:virtual|extended)\s+ram/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const tokenise = (s: string) =>
  s
    .replace(/[()[\],|/+]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

function parseCapacity(raw: string, unit: string): number {
  const n = Number(raw);
  return unit === "tb" ? n * 1024 : n;
}

export function canonicalColour(raw: string | null | undefined): string | null {
  const c = raw?.toLowerCase().replace(/\s+/g, " ").trim();
  if (!c) return null;
  for (const key of COLOUR_KEYS) if (new RegExp(`\\b${key}\\b`).test(c)) return COLOURS[key]!;
  return c;
}

/** Colour named in a variant segment: "(Peony, 256 GB)", "(128 GB) - Black", "| Nebula Noir |". */
function explicitColour(t: string): string | null {
  const segments = [
    ...[...t.matchAll(/\(([^()]*)\)/g)].flatMap((m) => m[1]!.split(",")),
    ...t.split("|").slice(1),
    ...(t.match(/\)\s+-\s+([a-z ]+)$/)?.slice(1) ?? []),
  ];
  for (const seg of segments) {
    const s = seg.trim();
    if (s && /^[a-z][a-z ]*$/.test(s) && s.split(" ").length <= 3 && !tokenise(s).every((w) => NOISE.has(w))) return s;
  }
  return null;
}

function normaliseId(v: string | null | undefined, digitsOnly: boolean): string | null {
  if (!v) return null;
  const s = digitsOnly ? v.replace(/\D/g, "").replace(/^0+(?=\d{13})/, "") : v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length >= 6 ? s : null;
}

export function extractAttributes(title: string, ids: ListingIdentifiers = {}): ProductAttributes {
  const t = normalise(title);
  let ramGb: number | null = null;
  let storageGb: number | null = null;

  const ramMatch = t.match(/(\d{1,2})\s?gb\s?ram/);
  if (ramMatch) ramGb = Number(ramMatch[1]);

  // "8/256", "8gb/256gb", "8 gb + 256 gb"
  const pair = t.match(/\b(\d{1,2})\s?(?:gb)?\s?[/+]\s?(\d{2,4}|1|2)\s?(gb|tb)/);
  if (pair) {
    ramGb ??= Number(pair[1]);
    storageGb = parseCapacity(pair[2]!, pair[3]!);
  }

  const caps = [...t.matchAll(/(\d{1,4})\s?(gb|tb)(?!\s?ram)/g)].map((m) => parseCapacity(m[1]!, m[2]!));
  if (storageGb === null) {
    const storage = caps.filter((n) => n >= 32);
    if (storage.length) storageGb = Math.max(...storage);
  }
  // "(Titanium Gray, 12GB, 256GB Storage)": a small capacity next to the storage is RAM.
  if (ramGb === null && storageGb !== null) ramGb = caps.find((n) => n <= 24) ?? null;

  const words = tokenise(t);
  let brand: string | null = null;
  for (const w of words) {
    if (BRANDS.includes(w)) brand = w;
    else if (BRAND_ALIASES[w]) brand = BRAND_ALIASES[w]!;
    if (brand) break;
  }
  if (!brand && ids.brand) {
    const b = ids.brand.toLowerCase().replace(/\s+/g, "");
    brand = BRAND_ALIASES[b] ?? b;
  }

  const rawColour = explicitColour(t);
  let colour = canonicalColour(rawColour);
  if (!colour) {
    const key = COLOUR_KEYS.find((k) => new RegExp(`\\b${k}\\b`).test(t));
    colour = key ? COLOURS[key]! : null;
  }

  const model = extractModel(t, brand, rawColour);
  const out: ProductAttributes = { brand, model, storageGb, ramGb, colour };
  const gtin = normaliseId(ids.gtin, true);
  const mpn = normaliseId(ids.mpn, false);
  if (gtin) out.gtin = gtin;
  if (mpn) out.mpn = mpn;
  return out;
}

function extractModel(t: string, brand: string | null, rawColour: string | null): string | null {
  // The model lives in the head of the title, before variant details in brackets/pipes/commas.
  let s = t.split(/[(|,[]| - /)[0]!;
  s = s.replace(/\d{1,4}\s?(gb|tb)(\s?ram)?/g, " ");
  for (const key of [rawColour, ...COLOUR_KEYS]) if (key) s = s.replace(new RegExp(`\\b${key}\\b`, "g"), " ");
  const tokens = tokenise(s).filter(
    (w) => !NOISE.has(w) && w !== brand && !BRANDS.includes(w) && !PURE_BRAND_ALIASES.has(w),
  );
  const model = tokens.slice(0, 5).join(" ");
  return model || null;
}

const fineTokens = (model: string) =>
  model
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean);

/** 1 = same model, 0 = definitely different model, otherwise token overlap. */
export function modelSimilarity(a: string, b: string): number {
  if (a.replace(/\s/g, "") === b.replace(/\s/g, "")) return 1;
  const ta = new Set(fineTokens(a));
  const tb = new Set(fineTokens(b));
  const numsA = [...ta].filter((x) => /^\d+$/.test(x)).sort().join();
  const numsB = [...tb].filter((x) => /^\d+$/.test(x)).sort().join();
  if (numsA !== numsB) return 0;
  const extra = [...ta].filter((x) => !tb.has(x)).concat([...tb].filter((x) => !ta.has(x)));
  if (extra.some((x) => MODEL_SUFFIXES.has(x))) return 0;
  const inter = [...ta].filter((x) => tb.has(x)).length;
  return inter / new Set([...ta, ...tb]).size;
}

export type MatchDecision = "same" | "different" | "uncertain";

export interface MatchResult {
  decision: MatchDecision;
  /** 0..1 */
  confidence: number;
  reasons: string[];
}

/** At or above this confidence two listings are auto-linked to the same variant. */
export const SAME_PRODUCT_THRESHOLD = 0.9;
/** Between this and SAME_PRODUCT_THRESHOLD, a pair is queued for human review. */
export const REVIEW_THRESHOLD = 0.5;

const different = (reason: string): MatchResult => ({ decision: "different", confidence: 0, reasons: [reason] });

export function matchProducts(a: ProductAttributes, b: ProductAttributes): MatchResult {
  if (a.brand && b.brand && a.brand !== b.brand) return different("brand mismatch");
  for (const key of ["storageGb", "ramGb", "colour"] as const) {
    if (a[key] !== null && b[key] !== null && a[key] !== b[key]) return different(`${key} mismatch`);
  }
  const modelSim = a.model && b.model ? modelSimilarity(a.model, b.model) : null;
  if (modelSim === 0) return different("model mismatch");

  for (const key of ["gtin", "mpn"] as const) {
    if (a[key] && a[key] === b[key]) return { decision: "same", confidence: 1, reasons: [key] };
  }

  const reasons: string[] = [];
  let confidence = 0;
  const add = (w: number, reason: string) => {
    confidence += w;
    reasons.push(reason);
  };
  if (a.brand && a.brand === b.brand) add(0.1, "brand");
  if (modelSim === 1) add(0.45, "model exact");
  else if (modelSim !== null) add(0.45 * modelSim * 0.5, `model ~${modelSim.toFixed(2)}`);
  for (const key of ["storageGb", "colour"] as const) {
    if (a[key] !== null && a[key] === b[key]) add(0.15, key);
    else reasons.push(`${key} unknown`);
  }
  // iPhone titles never state RAM, so RAM is not a variant axis for Apple.
  const ramIrrelevant = a.brand === "apple" || b.brand === "apple" || (a.ramGb === null && b.ramGb === null);
  if (ramIrrelevant || (a.ramGb !== null && a.ramGb === b.ramGb)) add(0.15, "ramGb");
  else reasons.push("ramGb unknown");

  confidence = Math.min(1, Number(confidence.toFixed(3)));
  const decision: MatchDecision =
    confidence >= SAME_PRODUCT_THRESHOLD ? "same" : confidence < REVIEW_THRESHOLD ? "different" : "uncertain";
  return { decision, confidence, reasons };
}

export function matchTitles(a: string, b: string): MatchResult {
  return matchProducts(extractAttributes(a), extractAttributes(b));
}
