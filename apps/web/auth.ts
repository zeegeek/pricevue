import "server-only";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb, schema } from "@pricevue/db";
import NextAuth, { type NextAuthConfig } from "next-auth";
import type { EmailConfig } from "next-auth/providers/email";
import Google from "next-auth/providers/google";

const isDev = process.env.NODE_ENV !== "production";

/** Magic-link email: sent via Resend when AUTH_RESEND_KEY is set, otherwise logged to the server console. */
const magicLink: EmailConfig = {
  id: "email",
  type: "email",
  name: "Email",
  from: process.env.AUTH_EMAIL_FROM ?? "PriceVue <login@pricevue.in>",
  maxAge: 24 * 60 * 60,
  options: {},
  async sendVerificationRequest({ identifier, url, provider }) {
    const key = process.env.AUTH_RESEND_KEY;
    if (!key) {
      console.log(`\n[auth] Magic sign-in link for ${identifier}:\n${url}\n`);
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: provider.from,
        to: identifier,
        subject: "Sign in to PriceVue",
        text: `Sign in to PriceVue:\n${url}\n\nIf you didn't request this, ignore this email.`,
        html: `<p><a href="${url}">Sign in to PriceVue</a></p><p>If you didn't request this, ignore this email.</p>`,
      }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(async (): Promise<NextAuthConfig> => ({
  adapter: DrizzleAdapter(await getDb(), {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [...(process.env.AUTH_GOOGLE_ID ? [Google] : []), magicLink],
  secret: process.env.AUTH_SECRET ?? (isDev ? "pricevue-dev-only-secret" : undefined),
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
}));

export const signInUrl = (callbackUrl: string) => `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
