import { STORES, type StoreId } from "@pricevue/core";
import { cn } from "@pricevue/ui";
import Link from "next/link";

interface V {
  id: number;
  storageGb: number | null;
  ramGb: number | null;
  colour: string | null;
  colourHex: string | null;
  stores: StoreId[];
}

export function VariantSelector({ slug, variants, selected }: { slug: string; variants: V[]; selected: V }) {
  const storages = [...new Set(variants.map((v) => v.storageGb))];
  const colours = [...new Map(variants.map((v) => [v.colour, v.colourHex])).entries()];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Storage</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {storages.map((s) => {
            const target = variants.find((v) => v.storageGb === s && v.colour === selected.colour) ?? variants.find((v) => v.storageGb === s)!;
            const active = s === selected.storageGb;
            return (
              <Link
                key={s}
                href={`/p/${slug}?v=${target.id}`}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                  active ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400" : "border-border hover:border-brand-400",
                )}
              >
                {s} GB
              </Link>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Colour · <span className="normal-case text-foreground">{selected.colour}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {colours.map(([colour, hex]) => {
            const exact = variants.find((v) => v.storageGb === selected.storageGb && v.colour === colour);
            const target = exact ?? variants.find((v) => v.colour === colour)!;
            const active = colour === selected.colour;
            return (
              <Link
                key={colour}
                href={`/p/${slug}?v=${target.id}`}
                scroll={false}
                aria-label={`${colour}${exact ? "" : " (other storage)"}`}
                aria-current={active ? "true" : undefined}
                className={cn("size-9 rounded-full border-2 p-0.5 transition", active ? "border-brand-500" : "border-transparent hover:border-border", !exact && "opacity-50")}
              >
                <span className="block size-full rounded-full ring-1 ring-black/10" style={{ background: hex ?? "#888" }} />
              </Link>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        🔒 Variant locked across stores — we only compare listings for exactly this {selected.ramGb} GB + {selected.storageGb} GB · {selected.colour} model
        {selected.stores.length < 2 && ` (only on ${selected.stores.map((s) => STORES[s].shortName).join(", ")})`}.
      </p>
    </div>
  );
}
