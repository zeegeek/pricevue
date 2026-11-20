import { STORE_IDS, STORES, isStoreId, rupeesToPaise } from "@pricevue/core";
import { DEAL_SORTS, dealBrands, listDeals, type DealSort } from "@pricevue/db";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Deals" };

const PAGE_SIZE = 24;
const sortLabels: Record<DealSort, string> = { drop: "Biggest drop", lowest: "Lowest ever", newest: "Newest" };
const field = "h-10 rounded-xl border border-border bg-card px-3 text-sm";

type Params = Partial<Record<"store" | "brand" | "min" | "max" | "drop" | "sort" | "page", string>>;

const num = (v?: string) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= 0 ? n : undefined;
};

export default async function DealsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const store = sp.store && isStoreId(sp.store) ? sp.store : undefined;
  const sort = DEAL_SORTS.find((s) => s === sp.sort) ?? "drop";
  const min = num(sp.min);
  const max = num(sp.max);
  const drop = num(sp.drop);
  const page = Math.max(1, Math.floor(num(sp.page) ?? 1));

  const database = await db();
  const [{ items, total }, brands] = await Promise.all([
    listDeals(database, {
      store,
      brand: sp.brand || undefined,
      minPaise: min != null ? rupeesToPaise(min) : undefined,
      maxPaise: max != null ? rupeesToPaise(max) : undefined,
      minDropPct: drop,
      sort,
      page,
      pageSize: PAGE_SIZE,
    }),
    dealBrands(database),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/deals?${q}`;
  };

  return (
    <div className="container py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        Deals
        <span className="ml-2 text-base font-medium text-muted-foreground">{total}</span>
      </h1>
      <p className="mt-1 text-muted-foreground">Real drops versus each listing&apos;s own recent price — never versus inflated MRPs.</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 text-sm" aria-label="Filter deals">
        <label className="flex flex-col gap-1">
          Store
          <select name="store" defaultValue={store ?? ""} className={field}>
            <option value="">All stores</option>
            {STORE_IDS.filter((id) => STORES[id].live).map((id) => (
              <option key={id} value={id}>{STORES[id].name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Brand
          <select name="brand" defaultValue={sp.brand ?? ""} className={field}>
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Min ₹
          <input name="min" type="number" min={0} inputMode="numeric" defaultValue={min} className={`${field} w-28`} />
        </label>
        <label className="flex flex-col gap-1">
          Max ₹
          <input name="max" type="number" min={0} inputMode="numeric" defaultValue={max} className={`${field} w-28`} />
        </label>
        <label className="flex flex-col gap-1">
          Min drop %
          <input name="drop" type="number" min={0} max={90} defaultValue={drop} className={`${field} w-24`} />
        </label>
        <label className="flex flex-col gap-1">
          Sort
          <select name="sort" defaultValue={sort} className={field}>
            {DEAL_SORTS.map((s) => (
              <option key={s} value={s}>{sortLabels[s]}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-xl bg-foreground px-4 font-semibold text-background">Apply</button>
        <Link href="/deals" className="h-10 content-center px-2 font-semibold text-muted-foreground hover:text-foreground">Reset</Link>
      </form>

      {items.length ? (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((c) => (
            <ProductCard
              key={c.slug}
              card={c}
              note={c.isLowestEver ? "Lowest price ever" : c.isLow90 ? "Lowest in 90 days" : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-muted-foreground">No live deals match these filters.</p>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4 text-sm font-semibold">
          {page > 1 ? <Link href={pageHref(page - 1)} className="hover:underline">← Previous</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? <Link href={pageHref(page + 1)} className="hover:underline">Next →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
