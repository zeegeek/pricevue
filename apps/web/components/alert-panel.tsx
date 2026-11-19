"use client";

import { formatINR, parseINRInput } from "@pricevue/core";
import { cn } from "@pricevue/ui";
import { Bell, Check } from "lucide-react";
import { useState } from "react";

const CHANNELS = ["Email", "Telegram", "WhatsApp"] as const;

export function AlertPanel({ currentPaise, lowestPaise }: { currentPaise: number; lowestPaise: number }) {
  const suggested = Math.round((lowestPaise * 1.02) / 10000) * 10000;
  const [target, setTarget] = useState(String(suggested / 100));
  const [channels, setChannels] = useState<Record<string, boolean>>({ Email: true, Telegram: false, WhatsApp: false });
  const [saved, setSaved] = useState(false);
  const parsed = parseINRInput(target);

  return (
    <form
      id="alert"
      className="rounded-2xl border border-border bg-card p-5 shadow-soft"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(true);
      }}
    >
      <h2 className="flex items-center gap-2 font-display font-bold">
        <Bell className="size-4 text-brand-500" aria-hidden /> Set a price alert
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">We&apos;ll ping you when any store drops below your target.</p>
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
        {CHANNELS.map((ch) => (
          <div key={ch} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm">
            <span id={`ch-${ch}`}>{ch}</span>
            <button
              type="button"
              role="switch"
              aria-checked={channels[ch]}
              aria-labelledby={`ch-${ch}`}
              onClick={() => setChannels((c) => ({ ...c, [ch]: !c[ch] }))}
              className={cn("relative h-6 w-11 rounded-full transition", channels[ch] ? "bg-brand-600" : "bg-border")}
            >
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ease-spring", channels[ch] ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
        ))}
      </fieldset>
      <button
        type="submit"
        disabled={!parsed}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
      >
        {saved ? (<><Check className="size-4" aria-hidden /> Alert saved (demo)</>) : "Create alert"}
      </button>
      <p className="sr-only" aria-live="polite">{saved ? "Alert saved" : ""}</p>
    </form>
  );
}
