import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Affiliate disclosure", alternates: { canonical: "/disclosure" } };

export default function DisclosurePage() {
  return (
    <LegalPage title="Affiliate disclosure">
      <p className="font-medium text-foreground">As an Amazon Associate PriceVue earns from qualifying purchases.</p>
      <p>
        PriceVue is a participant in the Amazon Associates Programme and may join other affiliate programmes (such as
        Flipkart Affiliate). When you click a &ldquo;Buy&rdquo; or store link on PriceVue and make a purchase, we may earn a
        commission from the store at no extra cost to you.
      </p>
      <h2>How this affects our content</h2>
      <p>
        Commissions never change the prices we show, the order of offers or our buy-or-wait verdicts. Offers are ranked by
        the effective price you pay. Prices and availability are fetched from the stores and may change at any time; the
        price on the store&apos;s website at the time of purchase applies.
      </p>
      <h2>Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
