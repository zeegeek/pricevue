import type { ReactNode } from "react";

export const LEGAL_UPDATED = "20 November 2026";
export const CONTACT_EMAIL = "hello@pricevue.in";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="container max-w-3xl py-12 text-sm leading-relaxed text-muted-foreground [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3">
      <h1 className="font-display text-3xl font-extrabold text-foreground">{title}</h1>
      <p>Last updated: {LEGAL_UPDATED}</p>
      {children}
    </article>
  );
}
