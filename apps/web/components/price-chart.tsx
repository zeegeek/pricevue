"use client";

import {
  bestPriceSeries,
  filterRange,
  formatINR,
  formatINRCompact,
  HISTORY_RANGES,
  priceStats,
  STORES,
  type HistoryRange,
  type StoreId,
} from "@pricevue/core";
import { cn } from "@pricevue/ui";
import { useMemo, useState } from "react";

type Series = Partial<Record<StoreId, { at: string; pricePaise: number }[]>>;

const W = 720;
const H = 260;
const PAD = { l: 52, r: 12, t: 16, b: 28 };

export function PriceChart({ history }: { history: Series }) {
  const [range, setRange] = useState<HistoryRange>("1Y");
  const [hover, setHover] = useState<number | null>(null);
  const stores = Object.keys(history) as StoreId[];

  const data = useMemo(() => {
    const filtered = Object.fromEntries(stores.map((s) => [s, filterRange(history[s] ?? [], range)])) as Record<StoreId, { at: string; pricePaise: number }[]>;
    const best = bestPriceSeries(filtered);
    const all = stores.flatMap((s) => filtered[s]);
    const times = all.map((p) => new Date(p.at).getTime());
    const prices = all.map((p) => p.pricePaise);
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const pad = (hi - lo) * 0.1 || hi * 0.05;
    const y0 = lo - pad;
    const y1 = hi + pad;
    const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
    const y = (p: number) => PAD.t + (1 - (p - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
    const path = (pts: { at: string | Date; pricePaise: number }[]) =>
      pts.map((p, i) => `${i ? "L" : "M"}${x(new Date(p.at).getTime()).toFixed(1)},${y(p.pricePaise).toFixed(1)}`).join("");
    return { filtered, best, stats: priceStats(best), x, y, path, y0, y1, t0, t1 };
  }, [history, range, stores]);

  const ticks = [0, 1, 2, 3].map((i) => data.y0 + ((data.y1 - data.y0) * i) / 3);
  const hovered = hover !== null ? data.best[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-sm">
          {stores.map((s) => (
            <span key={s} className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="h-1 w-4 rounded-full" style={{ background: STORES[s].line }} aria-hidden />
              {STORES[s].shortName}
            </span>
          ))}
        </div>
        <div role="tablist" aria-label="History range" className="inline-flex rounded-xl bg-muted p-1">
          {HISTORY_RANGES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                range === r ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={data.stats ? `Price history: lowest ${formatINR(data.stats.lowest)}, highest ${formatINR(data.stats.highest)}` : "Price history"}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            let best = 0;
            let dist = Infinity;
            data.best.forEach((p, i) => {
              const d = Math.abs(data.x(new Date(p.at).getTime()) - px);
              if (d < dist) {
                dist = d;
                best = i;
              }
            });
            setHover(best);
          }}
        >
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8B5CF6" stopOpacity=".28" />
              <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={data.y(t)} y2={data.y(t)} className="stroke-border" strokeDasharray="3 4" />
              <text x={PAD.l - 8} y={data.y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                {formatINRCompact(t)}
              </text>
            </g>
          ))}
          {data.best.length > 1 && (
            <path
              d={`${data.path(data.best)}L${data.x(data.t1)},${H - PAD.b}L${data.x(data.t0)},${H - PAD.b}Z`}
              fill="url(#area)"
            />
          )}
          {stores.map((s) => (
            <path
              key={`${s}-${range}`}
              d={data.path(data.filtered[s])}
              fill="none"
              stroke={STORES[s].line}
              strokeWidth="2"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1"
              className="animate-draw"
            />
          ))}
          {hovered && (
            <g>
              <line x1={data.x(new Date(hovered.at).getTime())} x2={data.x(new Date(hovered.at).getTime())} y1={PAD.t} y2={H - PAD.b} className="stroke-brand-500" />
              <circle cx={data.x(new Date(hovered.at).getTime())} cy={data.y(hovered.pricePaise)} r="5" className="fill-brand-600 stroke-card" strokeWidth="2" />
            </g>
          )}
        </svg>
        {hovered && (
          <div className="pointer-events-none absolute right-2 top-0 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lift" aria-live="polite">
            <p className="text-muted-foreground">{new Date(hovered.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
            <p className="tabular font-bold">Best {formatINR(hovered.pricePaise)}</p>
          </div>
        )}
      </div>

      {data.stats && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Current", data.stats.current, "text-foreground"],
            ["Lowest", data.stats.lowest, "text-emerald-600 dark:text-emerald-400"],
            ["Average", data.stats.average, "text-foreground"],
            ["Highest", data.stats.highest, "text-rose-600 dark:text-rose-400"],
          ].map(([label, value, tone]) => (
            <div key={label as string} className="rounded-xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={cn("tabular font-display text-lg font-bold", tone as string)}>{formatINR(value as number)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
