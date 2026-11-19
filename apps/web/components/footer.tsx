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
            <li>pricevue.in</li>
            <li>Privacy</li>
            <li>Terms</li>
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
