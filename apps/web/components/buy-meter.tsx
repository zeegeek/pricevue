import { formatINR, type BuyOrWait } from "@pricevue/core";

const copy = {
  buy: { title: "Good time to buy", tone: "text-emerald-600 dark:text-emerald-400" },
  fair: { title: "Fair price", tone: "text-amber-600 dark:text-amber-400" },
  wait: { title: "Consider waiting", tone: "text-rose-600 dark:text-rose-400" },
};

export function BuyMeter({ result }: { result: BuyOrWait }) {
  const c = copy[result.verdict];
  const angle = -90 + (result.score / 100) * 180;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold">Buy or wait?</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">not a forecast</span>
      </div>
      <div className="relative mx-auto mt-4 w-52">
        <svg viewBox="0 0 200 110" className="w-full" role="img" aria-label={`${c.title}: score ${result.score} of 100`}>
          <defs>
            <linearGradient id="meter" x1="0" x2="1">
              <stop offset="0" stopColor="#F43F5E" />
              <stop offset=".5" stopColor="#F59E0B" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
          </defs>
          <path d="M15 100 A85 85 0 0 1 185 100" fill="none" stroke="url(#meter)" strokeWidth="14" strokeLinecap="round" />
          <g transform={`rotate(${angle} 100 100)`} className="transition-transform duration-700 ease-spring">
            <line x1="100" y1="100" x2="100" y2="30" className="stroke-foreground" strokeWidth="4" strokeLinecap="round" />
          </g>
          <circle cx="100" cy="100" r="8" className="fill-foreground" />
        </svg>
      </div>
      <p className={`mt-2 text-center font-display text-xl font-extrabold ${c.tone}`}>{c.title}</p>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        Cheaper than {100 - result.percentile}% of the last {result.windowDays} days
        {result.aboveLowPaise > 0 ? ` · ${formatINR(result.aboveLowPaise)} above the low` : " · at its lowest"}.
      </p>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">Based only on this product&apos;s own price history.</p>
    </div>
  );
}
