import Link from "next/link";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/#deals" className="hover:text-foreground">Deals</Link>
          <Link href="/search?q=" className="hover:text-foreground">Smartphones</Link>
          <Link href="/#how" className="hover:text-foreground">How it works</Link>
          <Link href="/#alerts" className="hover:text-foreground">Alerts</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/#alerts" className="hidden h-10 items-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background sm:inline-flex">
            Get price alerts
          </Link>
        </div>
      </div>
    </header>
  );
}
