import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { AMAZON_OFFER_MAX_AGE_MS, createAdapterRegistry, type OfferSnapshot } from "@pricevue/core";
import { alertSecret, createAlertSender, getDb, runPriceAlerts, saveOfferSnapshot, schema } from "@pricevue/db";
import { processRefresh, REFRESH_QUEUE, type RefreshJob } from "./refresh";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const adapters = createAdapterRegistry(process.env);
if (!adapters.amazon?.isConfigured())
  console.warn("Amazon API not configured; Amazon listings will be skipped.");
const db = await getDb();

const sink = {
  saveOffer: (listingId: number, offer: OfferSnapshot) => saveOfferSnapshot(db, listingId, offer),
};

const worker = new Worker<RefreshJob>(
  REFRESH_QUEUE,
  (job) => processRefresh(job.data, adapters, sink),
  {
    connection,
    concurrency: 4,
  },
);
worker.on("completed", (job, result) => console.log(`[${REFRESH_QUEUE}] ${job.id}`, result));
worker.on("failed", (job, err) =>
  console.error(`[${REFRESH_QUEUE}] ${job?.id} failed`, err.message),
);

// Amazon offers may be cached for at most 1 hour, so Amazon listings refresh hourly; others every 6 hours.
const queue = new Queue<RefreshJob>(REFRESH_QUEUE, { connection });
const OTHER_REFRESH_MS = 6 * 60 * 60 * 1000;

async function enqueue(filter: (storeId: string) => boolean) {
  const bucket = Date.now();
  const listings = (await db.select().from(schema.storeListings)).filter((l) => filter(l.storeId));
  await queue.addBulk(
    listings.map((l) => ({
      name: "refresh",
      data: { listingId: l.id, storeId: l.storeId, externalId: l.externalId, url: l.url },
      opts: { jobId: `listing-${l.id}-${bucket}`, removeOnComplete: 1000, removeOnFail: 1000 },
    })),
  );
  return listings.length;
}

const amazonOnly = (s: string) => s === "amazon";
const others = (s: string) => s !== "amazon";
setInterval(() => void enqueue(amazonOnly), AMAZON_OFFER_MAX_AGE_MS);
setInterval(() => void enqueue(others), OTHER_REFRESH_MS);
const queued = (await enqueue(amazonOnly)) + (await enqueue(others));
console.log(`Worker started; queued ${queued} listings.`);

// Price-drop email alerts: checked periodically against the latest snapshots (one check at a time).
const ALERT_CHECK_MS = 15 * 60 * 1000;
const alertOptions = {
  send: createAlertSender(process.env),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  secret: alertSecret(process.env),
};
let alertsRunning = false;
async function checkAlerts() {
  if (alertsRunning) return;
  alertsRunning = true;
  try {
    console.log("[alerts]", await runPriceAlerts(db, alertOptions));
  } catch (err) {
    console.error("[alerts] check failed", err);
  } finally {
    alertsRunning = false;
  }
}
setInterval(() => void checkAlerts(), ALERT_CHECK_MS);
void checkAlerts();
