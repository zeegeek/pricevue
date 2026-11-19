import { describe, expect, it } from "vitest";
import { bestPriceSeries, buyOrWait, filterRange, priceStats, timesReached } from "../history";
import { formatINR, formatINRCompact, parseINRInput } from "../money";
import { rankOffers, savingsVsNextBest } from "../offers";

describe("money", () => {
  it("formats with Indian digit grouping", () => {
    expect(formatINR(12999900)).toBe("₹1,29,999");
    expect(formatINR(6199900)).toBe("₹61,999");
    expect(formatINRCompact(6199900)).toBe("₹62k");
    expect(formatINRCompact(12999900)).toBe("₹1.3L");
    expect(parseINRInput("₹ 59,999")).toBe(5999900);
    expect(parseINRInput("abc")).toBeNull();
  });
});

describe("rankOffers", () => {
  const offers = [
    { storeId: "amazon" as const, listedPaise: 6590000, shippingPaise: 0, inStock: true },
    { storeId: "flipkart" as const, listedPaise: 6199900, shippingPaise: 4000, inStock: true },
    { storeId: "croma" as const, listedPaise: 5000000, shippingPaise: 0, inStock: false },
  ];

  it("ranks by payable price (listed + shipping) and never picks out-of-stock as best", () => {
    const ranked = rankOffers(offers);
    expect(ranked.map((r) => r.offer.storeId)).toEqual(["flipkart", "amazon", "croma"]);
    expect(ranked[0]).toMatchObject({ isBest: true, payablePaise: 6203900, diffFromBestPaise: 0 });
    expect(ranked[1]).toMatchObject({ isBest: false, diffFromBestPaise: 386100 });
    expect(savingsVsNextBest(ranked)).toBe(386100);
  });
});

describe("history", () => {
  const day = (d: number) => new Date(Date.UTC(2026, 0, 1 + d)).toISOString();
  const series = [80, 70, 60, 75, 65].map((p, i) => ({ at: day(i), pricePaise: p * 100000 }));

  it("computes lowest/highest/average with dates", () => {
    expect(priceStats(series)).toMatchObject({
      current: 6500000,
      lowest: 6000000,
      highest: 8000000,
      average: 7000000,
      lowestAt: new Date(day(2)),
    });
    expect(priceStats([])).toBeNull();
  });

  it("filters by range", () => {
    const now = new Date(day(4));
    expect(filterRange(series, "1M", now)).toHaveLength(5);
    expect(filterRange([{ at: day(-60), pricePaise: 1 }, ...series], "1M", now)).toHaveLength(5);
    expect(filterRange([{ at: day(-60), pricePaise: 1 }, ...series], "All", now)).toHaveLength(6);
  });

  it("builds a carried-forward best-price series", () => {
    const best = bestPriceSeries({
      amazon: [{ at: day(0), pricePaise: 100 }, { at: day(2), pricePaise: 80 }],
      flipkart: [{ at: day(1), pricePaise: 90 }],
    });
    expect(best.map((p) => p.pricePaise)).toEqual([100, 90, 80]);
  });

  it("buy-or-wait reflects where today sits in its own history", () => {
    expect(buyOrWait(6000000, series)).toMatchObject({ verdict: "buy", score: 100, aboveLowPaise: 0 });
    expect(buyOrWait(8000000, series)).toMatchObject({ verdict: "wait", score: 20 });
    expect(buyOrWait(7000000, series)).toMatchObject({ verdict: "fair" });
    expect(buyOrWait(1, [])).toBeNull();
  });

  it("counts distinct times a target was reached", () => {
    expect(timesReached(6000000, series)).toBe(1);
    expect(timesReached(6600000, series)).toBe(2);
    expect(timesReached(1, series)).toBe(0);
  });
});
