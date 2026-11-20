import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        This policy explains what PriceVue (&ldquo;we&rdquo;) collects when you use pricevue.in and how we use it. We aim to
        collect as little as possible, in line with India&apos;s Digital Personal Data Protection Act, 2023.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account data: your email address and, if you sign in with Google, your name and profile picture.</li>
        <li>Watchlist and alerts: the products you track and the target prices you set.</li>
        <li>Technical data: basic server logs (IP address, browser, pages requested) kept for security and debugging.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To sign you in and keep your session active (a necessary cookie).</li>
        <li>To send the price-drop emails you asked for. Every alert email has a one-click unsubscribe link.</li>
        <li>To keep the service secure and working.</li>
      </ul>
      <p>We do not sell your personal data or use it for advertising.</p>
      <h2>Third parties</h2>
      <p>
        We use service providers to run PriceVue: hosting (Vercel), database (Neon), email delivery (Resend) and Google
        sign-in. When you click a store link you leave PriceVue, and that store&apos;s own privacy policy applies; stores such
        as Amazon may set cookies to attribute affiliate purchases.
      </p>
      <h2>Retention and your rights</h2>
      <p>
        We keep account data while your account is active. You can ask us to access, correct or delete your data, or
        withdraw consent, by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will respond within 30 days.
      </p>
      <h2>Changes</h2>
      <p>We may update this policy; the date above shows the latest version.</p>
    </LegalPage>
  );
}
