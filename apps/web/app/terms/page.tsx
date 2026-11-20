import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of use", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use">
      <p>By using pricevue.in you agree to these terms. If you do not agree, please do not use the site.</p>
      <h2>The service</h2>
      <p>
        PriceVue shows price history and compares prices across online stores. We do not sell products; purchases happen on
        the store&apos;s website under that store&apos;s terms.
      </p>
      <h2>Accuracy</h2>
      <p>
        Prices, availability, offers and verdicts are indicative, may be delayed and can be wrong. Always check the final
        price on the store before buying. We are not liable for any loss arising from reliance on information shown here.
      </p>
      <h2>Affiliate links</h2>
      <p>
        Some links are affiliate links and we may earn a commission. As an Amazon Associate PriceVue earns from qualifying
        purchases. See our <Link href="/disclosure">affiliate disclosure</Link>.
      </p>
      <h2>Your account</h2>
      <p>
        Keep your sign-in email secure. Do not misuse the service, scrape it, or attempt to disrupt it. We may suspend
        accounts that do.
      </p>
      <h2>Trademarks</h2>
      <p>Store names and logos belong to their respective owners and are used only to identify the stores.</p>
      <h2>Law</h2>
      <p>These terms are governed by the laws of India.</p>
      <h2>Contact</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Also see our <Link href="/privacy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
