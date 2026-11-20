import { formatINR } from "@pricevue/core";
import { listPendingMatches, type MatchSide } from "@pricevue/db";
import Link from "next/link";
import { StoreName } from "@/components/store-badge";
import { db } from "@/lib/db";
import { approveMatch, rejectMatch } from "./actions";

const PAGE_SIZE = 20;
const btn = "h-9 rounded-xl px-4 text-sm font-semibold";

function Side({ label, side, href }: { label: string; side: MatchSide; href?: string }) {
  const { brand, model, storageGb, ramGb, colour } = side.attrs;
  const attrs = { Brand: brand, Model: model, Storage: storageGb && `${storageGb} GB`, RAM: ramGb && `${ramGb} GB`, Colour: colour };
  return (
    <div className="flex gap-3">
      {side.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.imageUrl} alt="" className="size-20 shrink-0 rounded-lg bg-muted object-contain" />
      ) : (
        <div className="size-20 shrink-0 rounded-lg bg-muted" />
      )}
      <div className="min-w-0 space-y-1 text-sm">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="font-semibold">
          {href ? <Link href={href} className="hover:underline">{side.title}</Link> : side.title}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {side.store && <StoreName store={side.store} />}
          {side.pricePaise != null && <span className="font-semibold">{formatINR(side.pricePaise)}</span>}
          {side.url && <a href={side.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:underline">Open ↗</a>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs">
          {Object.entries(attrs).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export default async function AdminMatchesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Math.floor(Number((await searchParams).page) || 1));
  const { items, total } = await listPendingMatches(await db(), { page, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container space-y-6 py-10">
      <h1 className="font-display text-3xl font-bold">Pending matches <span className="text-muted-foreground">({total})</span></h1>
      {items.length === 0 && <p className="text-muted-foreground">Nothing to review.</p>}
      {items.map((m) => (
        <article key={m.id} className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-lg bg-muted px-2 py-1 font-bold">Score {m.confidence.toFixed(2)}</span>
            {m.reasons.map((r) => <span key={r} className="rounded-lg border border-border px-2 py-1 text-xs">{r}</span>)}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Side label="New listing" side={m.listing} />
            <Side label="Candidate variant" side={m.candidate} href={`/p/${m.candidate.productSlug}?v=${m.candidate.variantId}`} />
          </div>
          <div className="flex gap-3">
            <form action={approveMatch.bind(null, m.id)}>
              <button className={`${btn} bg-brand-gradient text-white`}>Approve — same product</button>
            </form>
            <form action={rejectMatch.bind(null, m.id)}>
              <button className={`${btn} border border-border`}>Reject — keep as separate variant</button>
            </form>
          </div>
        </article>
      ))}
      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`?page=${page - 1}`} className="hover:underline">← Previous</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? <Link href={`?page=${page + 1}`} className="hover:underline">Next →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
