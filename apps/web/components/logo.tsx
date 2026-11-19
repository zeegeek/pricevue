import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight" aria-label="PriceVue home">
      <span className="grid size-8 place-items-center rounded-xl bg-brand-gradient shadow-glow" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l5-5 4 3 8-9" />
        </svg>
      </span>
      <span>
        Price<span className="text-gradient">Vue</span>
      </span>
    </Link>
  );
}
