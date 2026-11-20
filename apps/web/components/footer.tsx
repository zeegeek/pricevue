import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="container grid gap-8 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Honest price history and live comparison across India&apos;s biggest stores. Never overpay.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Stores</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>Amazon.in</li>
            <li>Flipkart</li>
            <li>Myntra, Ajio, Croma — soon</li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold">PriceVue</p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li><Link href="/deals" className="hover:text-foreground">Deals</Link></li>
            <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
            <li><Link href="/disclosure" className="hover:text-foreground">Affiliate disclosure</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container space-y-1 py-6 text-xs text-muted-foreground">
          <p>As an Amazon Associate PriceVue earns from qualifying purchases.</p>
          <p>Prices and availability are indicative and may change. Links to stores may be affiliate links. © {new Date().getFullYear()} PriceVue.</p>
        </div>
      </div>
    </footer>
  );
}
