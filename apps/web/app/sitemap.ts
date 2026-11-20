import { listProductSlugs } from "@pricevue/db";
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics = ["", "/deals", "/privacy", "/terms", "/disclosure"].map((p) => ({ url: `${SITE_URL}${p}` }));
  const products = (await listProductSlugs(await db())).map((p) => ({
    url: `${SITE_URL}/p/${p.slug}`,
    lastModified: p.createdAt,
    changeFrequency: "daily" as const,
  }));
  return [...statics, ...products];
}
