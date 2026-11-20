import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { evaluateAlert, renderAlertEmail, type StoreId } from "@pricevue/core";
import type { Db } from "./client";
import { alertEvents, offers, products, storeListings, users, variants, watchlistItems } from "./schema";

export interface AlertEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}
export type AlertSender = (email: AlertEmail) => Promise<void>;

/** Sends via Resend when ALERTS_RESEND_KEY/AUTH_RESEND_KEY is set, otherwise logs to the console. */
export function createAlertSender(env: Record<string, string | undefined> = process.env): AlertSender {
  const key = env.ALERTS_RESEND_KEY ?? env.AUTH_RESEND_KEY;
  const from = env.ALERTS_EMAIL_FROM ?? "PriceVue Alerts <alerts@pricevue.in>";
  if (!key) {
    return async (e) => console.log(`\n[alerts] To ${e.to}: ${e.subject}\n${e.text}\n`);
  }
  return async (e) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: e.to, subject: e.subject, html: e.html, text: e.text, headers: e.headers }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  };
}

export function alertSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.ALERTS_SECRET ?? env.AUTH_SECRET;
  if (secret) return secret;
  if (env.NODE_ENV === "production") throw new Error("ALERTS_SECRET or AUTH_SECRET must be set");
  return "pricevue-dev-only-secret";
}

export function unsubscribeToken(itemId: number, secret: string): string {
  return createHmac("sha256", secret).update(`unsubscribe:${itemId}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribeToken(itemId: number, token: string, secret: string): boolean {
  const expected = Buffer.from(unsubscribeToken(itemId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function setEmailAlerts(db: Db, itemId: number, enabled: boolean) {
  const rows = await db
    .update(watchlistItems)
    .set({ emailAlerts: enabled })
    .where(eq(watchlistItems.id, itemId))
    .returning({ id: watchlistItems.id });
  return rows.length > 0;
}

export interface AlertRunOptions {
  send: AlertSender;
  siteUrl: string;
  secret: string;
  now?: Date;
}

/** Checks every email-enabled watchlist item against its variant's current best price and sends due alerts. */
export async function runPriceAlerts(db: Db, { send, siteUrl, secret, now = new Date() }: AlertRunOptions) {
  const best = db
    .selectDistinctOn([storeListings.variantId], {
      variantId: storeListings.variantId,
      listingId: storeListings.id,
      storeId: storeListings.storeId,
      payable: sql<number>`(${offers.listedPaise} + ${offers.shippingPaise})::int`.as("payable"),
    })
    .from(offers)
    .innerJoin(storeListings, eq(offers.listingId, storeListings.id))
    .where(and(eq(offers.isCurrent, true), eq(offers.inStock, true)))
    .orderBy(storeListings.variantId, sql`${offers.listedPaise} + ${offers.shippingPaise}`)
    .as("best");
  const last = db
    .selectDistinctOn([alertEvents.watchlistItemId], {
      itemId: alertEvents.watchlistItemId,
      pricePaise: sql<number>`${alertEvents.pricePaise}`.as("last_price"),
      sentAt: alertEvents.sentAt,
    })
    .from(alertEvents)
    .orderBy(alertEvents.watchlistItemId, desc(alertEvents.sentAt), desc(alertEvents.id))
    .as("last");

  const items = await db
    .select({
      id: watchlistItems.id,
      email: users.email,
      targetPaise: watchlistItems.targetPaise,
      lastSeenPaise: watchlistItems.lastSeenPaise,
      slug: products.slug,
      title: products.title,
      variantLabel: variants.label,
      variantId: variants.id,
      listingId: best.listingId,
      storeId: best.storeId,
      bestPaise: best.payable,
      lastPrice: last.pricePaise,
      lastSentAt: last.sentAt,
    })
    .from(watchlistItems)
    .innerJoin(users, eq(watchlistItems.userId, users.id))
    .innerJoin(variants, eq(watchlistItems.variantId, variants.id))
    .innerJoin(products, eq(variants.productId, products.id))
    .leftJoin(best, eq(best.variantId, variants.id))
    .leftJoin(last, eq(last.itemId, watchlistItems.id))
    .where(eq(watchlistItems.emailAlerts, true));

  const base = siteUrl.replace(/\/$/, "");
  let sent = 0;
  for (const item of items) {
    const lastAlert =
      item.lastPrice != null && item.lastSentAt ? { pricePaise: item.lastPrice, sentAt: new Date(item.lastSentAt) } : null;
    const decision = evaluateAlert({
      targetPaise: item.targetPaise,
      bestPaise: item.bestPaise,
      lastSeenPaise: item.lastSeenPaise,
      lastAlert,
      now,
    });
    if (decision && item.bestPaise != null && item.listingId != null) {
      const unsubscribeUrl = `${base}/alerts/unsubscribe?item=${item.id}&t=${unsubscribeToken(item.id, secret)}`;
      const email = renderAlertEmail({
        productTitle: item.title,
        variantLabel: item.variantLabel,
        storeId: item.storeId as StoreId,
        newPaise: item.bestPaise,
        previousPaise: decision.previousPaise,
        targetPaise: item.targetPaise,
        buyUrl: `${base}/go/${item.listingId}`,
        productUrl: `${base}/p/${item.slug}?v=${item.variantId}`,
        unsubscribeUrl,
      });
      await send({
        to: item.email,
        ...email,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      await db.insert(alertEvents).values({
        watchlistItemId: item.id,
        reason: decision.reason,
        listingId: item.listingId,
        pricePaise: item.bestPaise,
        previousPaise: decision.previousPaise,
        sentAt: now,
      });
      sent++;
    }
    if (item.bestPaise !== item.lastSeenPaise) {
      await db.update(watchlistItems).set({ lastSeenPaise: item.bestPaise }).where(eq(watchlistItems.id, item.id));
    }
  }
  return { checked: items.length, sent };
}
