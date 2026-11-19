import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { createAdapterRegistry, type OfferSnapshot } from "@pricevue/core";
import { getDb, saveOfferSnapshot, schema } from "@pricevue/db";
import { processRefresh, REFRESH_QUEUE, type RefreshJob } from "./refresh";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const adapters = createAdapterRegistry(process.env);
const db = await getDb();

const sink = {
  saveOffer: (listingId: number, offer: OfferSnapshot) => saveOfferSnapshot(db, listingId, offer),
};

const worker = new Worker<RefreshJob>(REFRESH_QUEUE, (job) => processRefresh(job.data, adapters, sink), {
  connection,
  concurrency: 4,
});
worker.on("completed", (job, result) => console.log(`[${REFRESH_QUEUE}] ${job.id}`, result));
worker.on("failed", (job, err) => console.error(`[${REFRESH_QUEUE}] ${job?.id} failed`, err.message));

// Enqueue every listing every 6 hours.
const queue = new Queue<RefreshJob>(REFRESH_QUEUE, { connection });
await queue.upsertJobScheduler("refresh-all", { every: 6 * 60 * 60 * 1000 }, { name: "schedule" });
const listings = await db.select().from(schema.storeListings);
await queue.addBulk(
  listings.map((l) => ({
    name: "refresh",
    data: { listingId: l.id, storeId: l.storeId, externalId: l.externalId, url: l.url },
    opts: { jobId: `listing-${l.id}`, removeOnComplete: 1000, removeOnFail: 1000 },
  })),
);
console.log(`Worker started; queued ${listings.length} listings.`);
