import type { Paise } from "./money";

export interface PricePoint {
  /** ISO date or timestamp. */
  at: string | Date;
  pricePaise: Paise;
}

export interface PriceStats {
  current: Paise;
  lowest: Paise;
  highest: Paise;
  average: Paise;
  lowestAt: Date;
  highestAt: Date;
}

export const HISTORY_RANGES = ["1M", "3M", "6M", "1Y", "All"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

const RANGE_DAYS: Record<Exclude<HistoryRange, "All">, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 182,
  "1Y": 365,
};

const DAY_MS = 86_400_000;

export function filterRange<T extends PricePoint>(points: T[], range: HistoryRange, now = new Date()): T[] {
  if (range === "All") return points;
  const from = now.getTime() - RANGE_DAYS[range] * DAY_MS;
  return points.filter((p) => new Date(p.at).getTime() >= from);
}

export function priceStats(points: PricePoint[]): PriceStats | null {
  if (points.length === 0) return null;
  let lo = points[0]!;
  let hi = points[0]!;
  let sum = 0;
  for (const p of points) {
    if (p.pricePaise < lo.pricePaise) lo = p;
    if (p.pricePaise > hi.pricePaise) hi = p;
    sum += p.pricePaise;
  }
  return {
    current: points[points.length - 1]!.pricePaise,
    lowest: lo.pricePaise,
    highest: hi.pricePaise,
    average: Math.round(sum / points.length),
    lowestAt: new Date(lo.at),
    highestAt: new Date(hi.at),
  };
}

/**
 * Collapses per-store series into a single "best price across stores" daily series.
 * Each store's last known price carries forward until it changes.
 */
export function bestPriceSeries(seriesByStore: Record<string, PricePoint[]>): PricePoint[] {
  const byDay = new Map<string, Map<string, Paise>>();
  for (const [store, points] of Object.entries(seriesByStore)) {
    for (const p of points) {
      const day = new Date(p.at).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, new Map());
      byDay.get(day)!.set(store, p.pricePaise);
    }
  }
  const days = [...byDay.keys()].sort();
  const last = new Map<string, Paise>();
  const out: PricePoint[] = [];
  for (const day of days) {
    for (const [store, price] of byDay.get(day)!) last.set(store, price);
    out.push({ at: `${day}T00:00:00.000Z`, pricePaise: Math.min(...last.values()) });
  }
  return out;
}

export type Verdict = "buy" | "fair" | "wait";

export interface BuyOrWait {
  verdict: Verdict;
  /** 0–100, 100 = cheapest it has been. Drives the meter needle. */
  score: number;
  /** Share of days in the window that were cheaper than today (0–100). */
  percentile: number;
  aboveLowPaise: Paise;
  windowDays: number;
}

/**
 * Compares today's price with its own history only. It is NOT a forecast.
 */
export function buyOrWait(current: Paise, history: PricePoint[]): BuyOrWait | null {
  if (history.length === 0) return null;
  const prices = history.map((p) => p.pricePaise);
  const cheaper = prices.filter((p) => p < current).length;
  const percentile = Math.round((cheaper / prices.length) * 100);
  const score = 100 - percentile;
  const verdict: Verdict = score >= 70 ? "buy" : score >= 40 ? "fair" : "wait";
  return {
    verdict,
    score,
    percentile,
    aboveLowPaise: Math.max(0, current - Math.min(...prices)),
    windowDays: history.length,
  };
}

/** Number of separate times the price crossed down to (or below) the target. */
export function timesReached(target: Paise, history: PricePoint[]): number {
  let hits = 0;
  let below = false;
  for (const p of history) {
    const now = p.pricePaise <= target;
    if (now && !below) hits++;
    below = now;
  }
  return hits;
}
