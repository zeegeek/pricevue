"use client";

import { formatINR, parseINRInput } from "@pricevue/core";
import { cn } from "@pricevue/ui";
import { Bell, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { trackPrice } from "@/app/watchlist/actions";

const COMING_SOON = ["Telegram", "WhatsApp"] as const;

interface Props {
  currentPaise: number;
  lowestPaise: number;
  variantId: number;
  returnTo: string;
  trackedTargetPaise?: number | null;
  trackedEmailAlerts?: boolean;
  tracked?: boolean;
}

export function AlertPanel({
  currentPaise,
  lowestPaise,
  variantId,
  returnTo,
  trackedTargetPaise,
  trackedEmailAlerts = true,
  tracked = false,
}: Props) {
  const suggested = Math.round((lowestPaise * 1.02) / 10000) * 10000;
  const [target, setTarget] = useState(String((trackedTargetPaise ?? suggested) / 100));
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState(trackedEmailAlerts);
  const [saved, setSaved] = useState(tracked);
  const parsed = parseINRInput(target);

  return (
    <form
      id="alert"
      className="rounded-2xl border border-border bg-card p-5 shadow-soft"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await trackPrice(variantId, parsed, returnTo, email);
          setSaved(true);
        });
      }}
    >
      <h2 className="flex items-center gap-2 font-display font-bold">
        <Bell className="size-4 text-brand-500" aria-hidden /> Track this price
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Add it to your watchlist and we&apos;ll ping you when any store drops below your target.</p>
      <label htmlFor="target" className="mt-4 block text-xs font-semibold text-muted-foreground">Target price</label>
      <div className="mt-1 flex items-center rounded-xl border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-brand-500">
        <span className="text-muted-foreground">₹</span>
        <input
          id="target"
          inputMode="numeric"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setSaved(false);
          }}
          className="tabular h-11 w-full bg-transparent px-2 font-semibold outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Now {formatINR(currentPaise)} · lowest {formatINR(lowestPaise)}
      </p>
      <fieldset className="mt-4 space-y-2">
        <legend className="text-xs font-semibold text-muted-foreground">Notify me on</legend>
        <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm">
          <span id="ch-Email">Email</span>
          <button
            type="button"
            role="switch"
            aria-checked={email}
            aria-labelledby="ch-Email"
            onClick={() => {
              setEmail((v) => !v);
              setSaved(false);
            }}
            className={cn("relative h-6 w-11 rounded-full transition", email ? "bg-brand-600" : "bg-border")}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ease-spring", email ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>
        {COMING_SOON.map((ch) => (
          <div key={ch} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            <span id={`ch-${ch}`}>{ch}</span>
            <span className="text-xs font-semibold">Coming soon</span>
          </div>
        ))}
      </fieldset>
      <button
        type="submit"
        disabled={!parsed || pending}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
      >
        {saved ? (<><Check className="size-4" aria-hidden /> On your watchlist</>) : pending ? "Saving…" : "Track price"}
      </button>
      <p className="sr-only" aria-live="polite">{saved ? "Added to watchlist" : ""}</p>
    </form>
  );
}
