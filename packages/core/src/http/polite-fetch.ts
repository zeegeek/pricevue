import type { Fetcher } from "../adapters/types";

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; PriceVueBot/0.1; +https://pricevue.in/bot) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export interface PoliteFetchOptions {
  fetcher?: Fetcher;
  userAgent?: string;
  /** Minimum gap between requests to the same host. */
  minIntervalMs?: number;
  retries?: number;
  baseDelayMs?: number;
  respectRobots?: boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

interface RobotsRules {
  allow: string[];
  disallow: string[];
}

/** Returns the Allow/Disallow rules that apply to `userAgent` (falls back to `*`). */
export function parseRobots(txt: string, userAgent: string): RobotsRules {
  const groups: (RobotsRules & { agents: string[] })[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const m = raw
      .replace(/#.*/, "")
      .trim()
      .match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], allow: [], disallow: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (current && value && key === "disallow") current.disallow.push(value);
    if (current && value && key === "allow") current.allow.push(value);
  }
  const ua = userAgent.toLowerCase();
  const match =
    groups.find((g) => g.agents.some((a) => a !== "*" && ua.includes(a))) ?? groups.find((g) => g.agents.includes("*"));
  return { allow: match?.allow ?? [], disallow: match?.disallow ?? [] };
}

function ruleMatches(rule: string, path: string): boolean {
  const anchored = rule.endsWith("$");
  const pattern = rule
    .replace(/\$$/, "")
    .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(path);
}

/** Longest matching rule wins; Allow wins ties. */
export function isPathAllowed(rules: RobotsRules, path: string): boolean {
  const best = (list: string[]) => Math.max(-1, ...list.filter((r) => ruleMatches(r, path)).map((r) => r.length));
  return best(rules.allow) >= best(rules.disallow);
}

/**
 * Wraps fetch with a real UA, per-host rate limiting, retry with exponential backoff
 * on 429/5xx/network errors, and robots.txt checks.
 */
export function createPoliteFetcher(opts: PoliteFetchOptions = {}): Fetcher {
  const {
    fetcher = fetch,
    userAgent = DEFAULT_USER_AGENT,
    minIntervalMs = 3000,
    retries = 3,
    baseDelayMs = 1000,
    respectRobots = true,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = Date.now,
  } = opts;
  const nextSlot = new Map<string, number>();
  const robots = new Map<string, Promise<RobotsRules>>();

  async function throttle(host: string) {
    const t = now();
    const slot = Math.max(t, nextSlot.get(host) ?? 0);
    nextSlot.set(host, slot + minIntervalMs);
    if (slot > t) await sleep(slot - t);
  }

  async function rawFetch(url: URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set("user-agent", userAgent);
    if (!headers.has("accept-language")) headers.set("accept-language", "en-IN,en;q=0.9");
    for (let attempt = 0; ; attempt++) {
      await throttle(url.host);
      try {
        const res = await fetcher(url.toString(), { ...init, headers });
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          const retryAfter = Number(res.headers.get("retry-after"));
          await sleep(retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * 2 ** attempt);
          continue;
        }
        return res;
      } catch (error) {
        if (attempt >= retries) throw error;
        await sleep(baseDelayMs * 2 ** attempt);
      }
    }
  }

  function robotsFor(url: URL): Promise<RobotsRules> {
    let rules = robots.get(url.origin);
    if (!rules) {
      rules = rawFetch(new URL("/robots.txt", url.origin), { headers: { accept: "text/plain" } })
        .then(async (res) => (res.ok ? parseRobots(await res.text(), userAgent) : { allow: [], disallow: [] }))
        .catch(() => ({ allow: [], disallow: [] }));
      robots.set(url.origin, rules);
    }
    return rules;
  }

  return async (input, init) => {
    const url = new URL(input);
    if (respectRobots && !isPathAllowed(await robotsFor(url), url.pathname + url.search)) {
      throw new RobotsDisallowedError(url.toString());
    }
    return rawFetch(url, init);
  };
}
