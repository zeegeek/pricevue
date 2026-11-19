"use client";

import { looksLikeUrl, STORES, STORE_IDS } from "@pricevue/core";
import { cn } from "@pricevue/ui";
import { Link2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function OmniSearch({ defaultValue = "", compact = false }: { defaultValue?: string; compact?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();
  const isUrl = looksLikeUrl(value.trim());

  return (
    <div className={cn("w-full", !compact && "max-w-2xl")}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(value.trim())}`);
        }}
        className={cn("gradient-border flex items-center gap-2 rounded-2xl shadow-lift", compact ? "p-1.5" : "p-2")}
      >
        <span className="pl-3 text-muted-foreground" aria-hidden>
          {isUrl ? <Link2 className="size-5 text-brand-500" /> : <Search className="size-5" />}
        </span>
        <label htmlFor="omni" className="sr-only">Search products or paste an Amazon / Flipkart link</label>
        <input
          id="omni"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search “iPhone 15” or paste an Amazon / Flipkart link"
          className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          autoComplete="off"
        />
        <button type="submit" className="h-12 shrink-0 rounded-xl bg-brand-gradient px-5 font-semibold text-white shadow-glow transition hover:brightness-110">
          {isUrl ? "Track" : "Compare"}
        </button>
      </form>
      {!compact && (
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Supported stores">
          {STORE_IDS.map((id) => {
            const s = STORES[id];
            return (
              <li
                key={id}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium",
                  !s.live && "opacity-60",
                )}
              >
                <span className="grid size-5 place-items-center rounded-md text-[10px] font-extrabold" style={{ background: s.bg, color: s.mark }} aria-hidden>
                  {s.letter}
                </span>
                {s.shortName}
                {!s.live && <span className="rounded-full bg-muted px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">soon</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
