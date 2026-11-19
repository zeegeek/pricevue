import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container py-24 text-center">
      <p className="text-gradient font-display text-6xl font-extrabold">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold">We couldn&apos;t find that product</h1>
      <p className="mt-2 text-muted-foreground">It may not be tracked yet. Try searching by name or pasting a product link.</p>
      <Link href="/" className="mt-6 inline-block rounded-xl bg-brand-gradient px-5 py-3 font-semibold text-white shadow-glow">
        Back to search
      </Link>
    </div>
  );
}
