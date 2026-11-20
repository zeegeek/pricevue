import type { Paise } from "./money";
import type { PricePoint } from "./history";

const DAY_MS = 86_400_000;
/** Minimum drop versus the typical price for a listing to count as a deal. */
export const MIN_DEAL_DROP_PCT = 3;
/** Need at least this much history before we trust a reference price. */
export const MIN_HISTORY_DAYS = 14;
const MIN_HISTORY_POINTS = 5;

export type DealScore = "great" | "good" | "fair";

export interface DealInput {
  currentPaise: Paise;
  /** In-stock price points strictly before the current snapshot (any order); at least the last 90 days. */
  history: PricePoint[];
  /** Lowest in-stock price ever recorded before the current snapshot, if older than `history`. */
  allTimeLowPaise?: Paise | null;
  now?: Date;
}

export interface DealSignal {
  pricePaise: Paise;
  referencePaise: Paise;
  dropPct: number;
  isLowestEver: boolean;
  isLow90: boolean;
  /** Ranking value: drop % plus bonuses for record lows. */
  points: number;
  score: DealScore;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/**
 * Detects a genuine deal from the listing's own price history. MRP is deliberately ignored, so
 * "70% off MRP" banners on a price that never moves don't qualify. The reference is the lower of
 * the 30- and 90-day medians, so a short pre-sale markup can't inflate the discount.
 */
export function detectDeal({ currentPaise, history, allTimeLowPaise, now = new Date() }: DealInput): DealSignal | null {
  const t = now.getTime();
  const prior = history.filter((p) => new Date(p.at).getTime() < t);
  if (prior.length < MIN_HISTORY_POINTS) return null;
  const oldest = Math.min(...prior.map((p) => new Date(p.at).getTime()));
  if (t - oldest < MIN_HISTORY_DAYS * DAY_MS) return null;

  const within = (days: number) => prior.filter((p) => new Date(p.at).getTime() >= t - days * DAY_MS).map((p) => p.pricePaise);
  const last30 = within(30);
  const last90 = within(90);
  if (last90.length === 0) return null;
  const referencePaise = last30.length ? Math.min(median(last30), median(last90)) : median(last90);

  const dropPct = Math.round(((referencePaise - currentPaise) / referencePaise) * 1000) / 10;
  if (dropPct < MIN_DEAL_DROP_PCT) return null;

  const low90 = Math.min(...last90);
  const everLow = Math.min(low90, ...prior.map((p) => p.pricePaise), allTimeLowPaise ?? Infinity);
  const isLow90 = currentPaise <= low90;
  const isLowestEver = currentPaise <= everLow;
  const points = Math.round((dropPct + (isLowestEver ? 5 : isLow90 ? 3 : 0)) * 10) / 10;
  const score: DealScore = points >= 15 ? "great" : points >= 8 ? "good" : "fair";
  return { pricePaise: currentPaise, referencePaise, dropPct, isLowestEver, isLow90, points, score };
}
