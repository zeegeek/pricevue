import { alertSecret, setEmailAlerts, verifyUnsubscribeToken } from "@pricevue/db";
import { db } from "@/lib/db";

/** One-click unsubscribe for a single watchlist item's email alerts (GET link and RFC 8058 POST). */
async function handle(req: Request) {
  const params = new URL(req.url).searchParams;
  const itemId = Number(params.get("item"));
  const token = params.get("t") ?? "";
  const ok =
    Number.isInteger(itemId) &&
    verifyUnsubscribeToken(itemId, token, alertSecret(process.env)) &&
    (await setEmailAlerts(await db(), itemId, false));
  const message = ok
    ? "You won't get any more email alerts for this item. You can turn them back on from the product page."
    : "This unsubscribe link is invalid or the item is no longer on your watchlist.";
  return new Response(
    `<!doctype html><meta name="viewport" content="width=device-width"><title>PriceVue alerts</title><body style="font-family:system-ui;max-width:480px;margin:64px auto;padding:0 16px"><h1>${ok ? "Unsubscribed" : "Link not valid"}</h1><p>${message}</p><p><a href="/watchlist">Go to your watchlist</a></p></body>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" } },
  );
}

export const GET = handle;
export const POST = handle;
