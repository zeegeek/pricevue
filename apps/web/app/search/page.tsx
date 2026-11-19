import { looksLikeUrl, parseProductUrl } from "@pricevue/core";
import { findByListing, searchProducts } from "@pricevue/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OmniSearch } from "@/components/omni-search";
import { ProductCard } from "@/components/product-card";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const database = await db();
  let notice: string | null = null;

  if (q && looksLikeUrl(q)) {
    const parsed = parseProductUrl(q);
    if (parsed.ok && "externalId" in parsed) {
      const hit = await findByListing(database, parsed.store, parsed.externalId);
      if (hit) redirect(`/p/${hit.slug}?v=${hit.variantId}`);
      notice = "We're not tracking that product yet — it's been queued. Meanwhile, here are phones we track.";
    } else if (parsed.ok) {
      notice = "Short links need to be expanded first. Please paste the full product URL.";
    } else {
      notice =
        parsed.reason === "unsupported_store"
          ? "That store isn't supported yet — Myntra, Ajio and Croma are coming soon."
          : "That doesn't look like a product link.";
    }
  }

  const results = await searchProducts(database, notice ? "" : q);

  return (
    <div className="container py-10">
      <OmniSearch defaultValue={q} compact />
      {notice && (
        <p role="status" className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      <h1 className="mt-8 font-display text-2xl font-extrabold">
        {q && !notice ? <>Results for “{q}”</> : "All tracked smartphones"}
        <span className="ml-2 text-base font-medium text-muted-foreground">{results.length}</span>
      </h1>
      {results.length ? (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {results.map((c) => (
            <ProductCard key={c.slug} card={c} />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-muted-foreground">No matches. Try a brand like “Samsung” or paste a product link.</p>
      )}
    </div>
  );
}
