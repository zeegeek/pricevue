/**
 * Ingest one product URL (Amazon via the Creators API, Flipkart via the polite fetcher) and,
 * if the listing is tracked, write a price snapshot.
 * Usage: pnpm --filter @pricevue/worker ingest <amazon-or-flipkart-url> [--dry-run]
 */
import {
  AmazonAdapter,
  FlipkartAdapter,
  flipkartConfigFromEnv,
  parseProductUrl,
} from "@pricevue/core";
import { findListingId, getDb, saveOfferSnapshot } from "@pricevue/db";

const [url, ...flags] = process.argv.slice(2);
const parsed = url ? parseProductUrl(url) : null;
if (
  !parsed?.ok ||
  !("externalId" in parsed) ||
  (parsed.store !== "amazon" && parsed.store !== "flipkart")
) {
  console.error(
    "Usage: ingest <amazon.in-or-flipkart-product-url> [--dry-run]  (short links are not supported yet)",
  );
  process.exit(1);
}

const adapter =
  parsed.store === "amazon"
    ? new AmazonAdapter()
    : new FlipkartAdapter({ ...flipkartConfigFromEnv(), scraperEnabled: true });
if (!adapter.isConfigured()) {
  console.warn(
    "Amazon API not configured (set AMAZON_CREATORS_API_CREDENTIAL_ID/SECRET); skipping.",
  );
  process.exit(0);
}
const offer = await adapter.getOffer(parsed.externalId, { url: parsed.canonicalUrl });
if (!offer) {
  console.error(`No price found for ${parsed.canonicalUrl}`);
  process.exit(2);
}
console.log(JSON.stringify(offer, null, 2));

if (!flags.includes("--dry-run")) {
  const db = await getDb();
  const listingId = await findListingId(db, parsed.store, parsed.externalId);
  if (listingId) {
    await saveOfferSnapshot(db, listingId, offer);
    console.log(`Saved snapshot for listing ${listingId}.`);
  } else {
    console.log(`Listing ${parsed.store}/${parsed.externalId} is not tracked; nothing saved.`);
  }
}
process.exit(0);
