import { affiliateConfigFromEnv, buildAffiliateUrl } from "@pricevue/core";
import { getListing } from "@pricevue/db";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const id = Number(listingId);
  const listing = Number.isInteger(id) ? await getListing(await db(), id) : null;
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = buildAffiliateUrl(listing.storeId, listing.url, affiliateConfigFromEnv(process.env));
  return NextResponse.redirect(url, { status: 302, headers: { "X-Robots-Tag": "noindex" } });
}
