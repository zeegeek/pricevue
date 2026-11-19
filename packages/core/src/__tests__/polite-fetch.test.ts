import { describe, expect, it, vi } from "vitest";
import { RobotsDisallowedError, createPoliteFetcher, isPathAllowed, parseRobots } from "../http/polite-fetch";

const robots =
  "User-agent: *\nDisallow: /search\nDisallow: /*?*q=\nAllow: /search/ok\n\nUser-agent: BadBot\nDisallow: /";

function setup(responses: Record<string, (() => Response)[]>) {
  let clock = 0;
  const sleep = vi.fn(async (ms: number) => void (clock += ms));
  const fetcher = vi.fn(async (url: string, _init?: RequestInit) => {
    const queue = responses[url];
    if (!queue?.length) return new Response("not found", { status: 404 });
    return queue.length > 1 ? queue.shift()!() : queue[0]!();
  });
  const polite = createPoliteFetcher({
    fetcher,
    sleep,
    now: () => clock,
    minIntervalMs: 1000,
    baseDelayMs: 100,
  });
  return { polite, fetcher, sleep };
}

describe("robots.txt", () => {
  it("applies the matching group with longest-rule precedence", () => {
    const rules = parseRobots(robots, "PriceVueBot/0.1");
    expect(isPathAllowed(rules, "/apple-iphone-15/p/itm123")).toBe(true);
    expect(isPathAllowed(rules, "/search?x=1")).toBe(false);
    expect(isPathAllowed(rules, "/search/ok")).toBe(true);
    expect(isPathAllowed(parseRobots(robots, "BadBot"), "/anything")).toBe(false);
  });
});

describe("createPoliteFetcher", () => {
  it("refuses robots-disallowed URLs without fetching them", async () => {
    const { polite, fetcher } = setup({
      "https://www.flipkart.com/robots.txt": [() => new Response(robots)],
    });
    await expect(polite("https://www.flipkart.com/search?q=phone")).rejects.toBeInstanceOf(RobotsDisallowedError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("sends a real UA, retries 5xx with backoff and rate-limits per host", async () => {
    const page = "https://www.flipkart.com/x/p/itm123";
    const { polite, fetcher, sleep } = setup({
      [page]: [() => new Response("", { status: 503 }), () => new Response("ok")],
    });
    const res = await polite(page);
    expect(await res.text()).toBe("ok");
    expect(fetcher).toHaveBeenCalledTimes(3); // robots + 503 + ok
    const ua = new Headers(fetcher.mock.calls[2]![1]!.headers).get("user-agent");
    expect(ua).toMatch(/Mozilla\/5\.0.*PriceVueBot/);
    expect(sleep).toHaveBeenCalledWith(100); // backoff
    expect(sleep.mock.calls.every(([ms]) => ms >= 100)).toBe(true);
    expect(sleep.mock.calls.map(([ms]) => ms)).toContain(1000); // per-host spacing
  });
});
