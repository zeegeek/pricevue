import { STORES, type StoreId } from "@pricevue/core";
import { cn } from "@pricevue/ui";

export function StoreMark({ store, className }: { store: StoreId; className?: string }) {
  const meta = STORES[store];
  return (
    <span
      className={cn("grid size-7 shrink-0 place-items-center rounded-lg text-xs font-extrabold", className)}
      style={{ background: meta.bg, color: meta.mark }}
      aria-hidden
    >
      {meta.letter}
    </span>
  );
}

export function StoreName({ store }: { store: StoreId }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold">
      <StoreMark store={store} />
      {STORES[store].name}
    </span>
  );
}
