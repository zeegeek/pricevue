import { formatINR, type Paise } from "./money";
import { STORES, type StoreId } from "./stores";

export const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** A drop of at least this fraction vs. the last alert (or last seen price) counts as meaningful. */
export const MEANINGFUL_DROP = 0.05;

export interface AlertState {
  targetPaise: Paise | null;
  bestPaise: Paise | null;
  lastSeenPaise: Paise | null;
  lastAlert: { pricePaise: Paise; sentAt: Date } | null;
  now: Date;
}

export interface AlertDecision {
  reason: "target" | "drop";
  previousPaise: Paise | null;
}

/**
 * Decides whether a watchlist item should be alerted. Never repeats an alert within the cooldown
 * unless the price fell below the last alerted price, and never re-alerts an unchanged price.
 */
export function evaluateAlert({ targetPaise, bestPaise, lastSeenPaise, lastAlert, now }: AlertState): AlertDecision | null {
  if (bestPaise == null) return null;
  const hitsTarget = targetPaise != null && bestPaise <= targetPaise;
  const ref = lastAlert?.pricePaise ?? lastSeenPaise;
  const dropped = ref != null && bestPaise <= ref * (1 - MEANINGFUL_DROP);
  if (!hitsTarget && !dropped) return null;
  const decision: AlertDecision = { reason: hitsTarget ? "target" : "drop", previousPaise: ref };
  if (!lastAlert) return decision;
  if (bestPaise < lastAlert.pricePaise) return decision;
  if (now.getTime() - lastAlert.sentAt.getTime() < ALERT_COOLDOWN_MS) return null;
  // After the cooldown, only re-alert if the price fell again since the last check (e.g. after a rebound).
  return lastSeenPaise != null && bestPaise < lastSeenPaise ? { ...decision, previousPaise: lastSeenPaise } : null;
}

export interface AlertEmailInput {
  productTitle: string;
  variantLabel: string;
  storeId: StoreId;
  newPaise: Paise;
  previousPaise: Paise | null;
  targetPaise: Paise | null;
  buyUrl: string;
  productUrl: string;
  unsubscribeUrl: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderAlertEmail(i: AlertEmailInput): { subject: string; html: string; text: string } {
  const store = STORES[i.storeId].name;
  const name = `${i.productTitle} (${i.variantLabel})`;
  const now = formatINR(i.newPaise);
  const was = i.previousPaise != null && i.previousPaise > i.newPaise ? formatINR(i.previousPaise) : null;
  const subject = `Price drop: ${name} is now ${now} on ${store}`;
  const text = [
    `${name} is now ${now} on ${store}${was ? ` (was ${was})` : ""}.`,
    i.targetPaise != null ? `Your target: ${formatINR(i.targetPaise)}` : "",
    `Buy: ${i.buyUrl}`,
    `Price history: ${i.productUrl}`,
    "",
    `Stop alerts for this item: ${i.unsubscribeUrl}`,
  ]
    .filter((l, idx, a) => l || a[idx - 1])
    .join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:16px;padding:24px">
<tr><td style="font-weight:800;font-size:20px;color:#4f46e5">PriceVue</td></tr>
<tr><td style="padding-top:16px;font-size:13px;color:#666">Price drop on ${esc(store)}</td></tr>
<tr><td style="padding-top:4px;font-size:18px;font-weight:700">${esc(name)}</td></tr>
<tr><td style="padding-top:12px;font-size:28px;font-weight:800">${now}${was ? ` <span style="font-size:16px;font-weight:400;color:#888;text-decoration:line-through">${was}</span>` : ""}</td></tr>
${i.targetPaise != null ? `<tr><td style="font-size:13px;color:#666">Your target: ${formatINR(i.targetPaise)}</td></tr>` : ""}
<tr><td style="padding-top:20px"><a href="${esc(i.buyUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Buy on ${esc(store)}</a>
&nbsp;<a href="${esc(i.productUrl)}" style="color:#4f46e5;font-size:14px">See price history</a></td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#999">You're getting this because you track this item on PriceVue. <a href="${esc(i.unsubscribeUrl)}" style="color:#999">Stop alerts for this item</a>.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}
