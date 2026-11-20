import { Heart, LogOut } from "lucide-react";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export async function Header() {
  const user = (await auth())?.user;
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/deals" className="hover:text-foreground">Deals</Link>
          <Link href="/search?q=" className="hover:text-foreground">Smartphones</Link>
          <Link href="/#how" className="hover:text-foreground">How it works</Link>
          <Link href="/#alerts" className="hover:text-foreground">Alerts</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <details className="relative">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold">
                <span className="grid size-6 place-items-center rounded-full bg-brand-gradient text-xs text-white" aria-hidden>
                  {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[10rem] truncate sm:inline">{user.name ?? user.email}</span>
              </summary>
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-1 text-sm shadow-soft">
                <Link href="/watchlist" className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted">
                  <Heart className="size-4" aria-hidden /> Watchlist
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted">
                    <LogOut className="size-4" aria-hidden /> Sign out
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <Link href="/api/auth/signin" className="inline-flex h-10 items-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
