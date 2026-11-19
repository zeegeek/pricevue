/**
 * Ingest one Flipkart product URL: fetch politely, parse, and (if the listing is tracked) write a price snapshot.
 * Usage: pnpm --filter @pricevue/worker ingest <flipkart-url> [--dry-run]
 */
import { FlipkartAdapter, flipkartConfigFromEnv, parseFlipkartUrl } from "@pricevue/core";
import { findListingId, getDb, saveOfferSnapshot } from "@pricevue/db";

const [url, ...flags] = process.argv.slice(2);
const parsed = url ? parseFlipkartUrl(url) : null;
if (!parsed?.ok || !("externalId" in parsed)) {
  console.error("Usage: ingest <flipkart-product-url> [--dry-run]  (short fkrt.it links are not supported yet)");
  process.exit(1);
}

const adapter = new FlipkartAdapter({ ...flipkartConfigFromEnv(), scraperEnabled: true });
const offer = await adapter.getOffer(parsed.externalId, { url: parsed.canonicalUrl });
if (!offer) {
  console.error(`No price found for ${parsed.canonicalUrl}`);
  process.exit(2);
}
console.log(JSON.stringify(offer, null, 2));

if (!flags.includes("--dry-run")) {
  const db = await getDb();
  const listingId = await findListingId(db, "flipkart", parsed.externalId);
  if (listingId) {
    await saveOfferSnapshot(db, listingId, offer);
    console.log(`Saved snapshot for listing ${listingId}.`);
  } else {
    console.log(`Listing flipkart/${parsed.externalId} is not tracked; nothing saved.`);
  }
}
process.exit(0);
