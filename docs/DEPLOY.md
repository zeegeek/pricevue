# Launching PriceVue on pricevue.in

This guide takes PriceVue from this repo to a live site at **https://pricevue.in**. Follow the steps in order. You don't
need to be a DevOps expert. Plan on 1–2 hours, plus up to a day for DNS to propagate.

## What runs where

| Piece                          | Service                      | Cost                                                         |
| ------------------------------ | ---------------------------- | ------------------------------------------------------------ |
| Web app (`apps/web`)           | **Vercel** Hobby             | Free, SSL included                                           |
| Database (Postgres)            | **Neon** Free                | Free (Singapore region)                                      |
| Queue (Redis)                  | **Upstash** Redis            | Free tier; pay-as-you-go if you exceed it (see step 2)       |
| Worker (`apps/worker`)         | **Railway** Hobby            | About US$5/month (includes $5 of usage)                      |
| Email (sign-in links, alerts)  | **Resend** Free              | Free up to 3,000 emails/month                                |
| Domain                         | **Hostinger** (DNS only)     | Already bought                                               |

The worker is a long-running process (price refresh, deal detection every 15 minutes, alert emails), so it can't run on
Vercel. Render and Fly.io also work with the same Dockerfile, but Railway is the simplest cheap option.

> Keep every secret in a password manager. Never commit `.env` files.

---

## 1. Neon (Postgres)

1. Sign up at <https://neon.tech> (GitHub login is fine).
2. Create a project: name `pricevue`, Postgres 16 or newer, region **AWS Asia Pacific (Singapore)**. It's the closest
   to India, and Vercel will run in Singapore too.
3. On the project dashboard, click **Connect**. Copy two connection strings:
   - **Pooled** (host contains `-pooler`): use for the **web app**.
   - **Direct** (turn "Connection pooling" off): use for the **worker** and for **migrations**.
   Both end in `?sslmode=require`. Keep that.

### Run the migrations (once now, and after every release that adds a migration)

From your laptop, in the repo root:

```bash
npx -y pnpm@9.15.0 install
DATABASE_URL='<Neon DIRECT connection string>' npx -y pnpm@9.15.0 db:migrate:prod
```

You should see `Migrations applied (postgres).` `db:migrate:prod` refuses to run without `DATABASE_URL`, so it can't
silently migrate the local PGlite database instead.

**Don't run `db:seed` in production.** The seed creates demo products with *synthetic* price history, which would show
fake prices to real users. Add real products with the ingest command instead (step 4).

## 2. Upstash (Redis for the job queue)

1. Sign up at <https://upstash.com>, then **Create Database** → Redis.
2. Name `pricevue`, primary region **ap-south-1 (Mumbai)** or **ap-southeast-1 (Singapore)**. Turn on **TLS** (it's on
   by default). Leave eviction **off**, because BullMQ must not lose keys.
3. Copy the **`rediss://…`** connection string (Details → Connect → ioredis). It goes in `REDIS_URL` for the worker only.

> BullMQ polls Redis even when idle, so it can use up the free tier's monthly command allowance. If Upstash warns you
> about the limit, switch the database to **Pay as you go** and set a budget cap. Or add Railway's Redis plugin next
> to the worker and use its URL instead.

## 3. Vercel (web app)

1. Sign up at <https://vercel.com> with GitHub and allow access to `zeegeek/pricevue`.
2. **Add New → Project →** import `zeegeek/pricevue`, then configure:
   - **Root Directory:** `apps/web` (click *Edit*). Leave "Include files outside the root directory" **on**.
   - **Framework preset:** Next.js (auto-detected; `apps/web/vercel.json` pins it).
   - **Install/Build commands:** leave as the defaults. `vercel.json` sets `pnpm install --frozen-lockfile`, and the
     build runs `next build`.
   - **Node.js version:** 20.x or newer (Settings → General). The repo's `.nvmrc` says 20.
   - Functions run in **Singapore (`sin1`)**, next to Neon. This is set in `vercel.json`.
3. Add the **web** environment variables from the table in [Environment variables](#environment-variables) for the
   **Production** environment. Add them to Preview too if you want preview deployments to work.
4. Click **Deploy**. When it's green, open the `*.vercel.app` URL and check the home page loads.

The web server checks its environment when it starts. If `DATABASE_URL`, `AUTH_SECRET` or `NEXT_PUBLIC_SITE_URL` is
missing in production, it refuses to start and names the missing variables in the Vercel logs.

## 4. Worker (Railway)

1. Sign up at <https://railway.com> with GitHub and choose the **Hobby** plan.
2. **New Project → Deploy from GitHub repo →** `zeegeek/pricevue`.
3. In the service's **Settings**:
   - **Root Directory:** leave empty (the repo root). The Dockerfile needs the whole monorepo.
   - **Builder:** Dockerfile. **Dockerfile path:** `apps/worker/Dockerfile`.
   - **Region:** Southeast Asia (Singapore).
   - **Networking:** don't generate a domain, because the worker has no web port.
   - **Restart policy:** On failure.
4. Add the **worker** environment variables (table below), then deploy. The logs should show
   `Worker started; queued N listings.` If a required variable is missing, the worker exits right away and names it.
5. **Add real products** (optional, any time) from your laptop. Use the Neon *direct* URL plus your Amazon or Flipkart
   credentials:

   ```bash
   DATABASE_URL='<Neon DIRECT>' AMAZON_ASSOCIATE_TAG=pricevue-21 AMAZON_CREATORS_API_CREDENTIAL_ID=… \
   AMAZON_CREATORS_API_CREDENTIAL_SECRET=… npx -y pnpm@9.15.0 --filter @pricevue/worker ingest '<product URL>'
   ```

To test the image locally: `docker build -f apps/worker/Dockerfile -t pricevue-worker .` then
`docker run --env-file .env pricevue-worker`.

## Environment variables

Generate secrets with `openssl rand -base64 32`.

| Variable | Web (Vercel) | Worker (Railway) | Value |
| --- | :-: | :-: | --- |
| `DATABASE_URL` | ✅ required | ✅ required | Neon **pooled** URL for web, **direct** URL for worker |
| `NEXT_PUBLIC_SITE_URL` | ✅ required | ✅ required | `https://pricevue.in` (no trailing slash). Used for canonical URLs, the sitemap and alert links |
| `AUTH_SECRET` | ✅ required | ✅ (same value) | Random secret. The worker uses it to sign unsubscribe links unless `ALERTS_SECRET` is set |
| `ALERTS_SECRET` | optional | optional | If set, it must be **identical** on web and worker |
| `REDIS_URL` | – | ✅ required | Upstash `rediss://…` URL |
| `AMAZON_ASSOCIATE_TAG` | ✅ | ✅ | Your Associates tag, e.g. `pricevue-21` |
| `AMAZON_MARKETPLACE` | – | ✅ | `www.amazon.in` |
| `AMAZON_CREATORS_API_CREDENTIAL_ID` / `_SECRET` | – | ✅ when available | From Associates Central → Creators API. Without them, Amazon refreshes are skipped |
| `AMAZON_CREATORS_API_VERSION` | – | ✅ | `3.2` |
| `FLIPKART_AFFILIATE_ID` | ✅ | ✅ | From Flipkart Affiliate, once approved |
| `FLIPKART_AFFILIATE_TOKEN` | – | ✅ | From Flipkart Affiliate |
| `FLIPKART_SCRAPER_ENABLED` | – | `false` | **Keep `false`.** The Docker image defaults to `false` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | ✅ | – | Google OAuth client (step 6). Google sign-in is hidden when unset |
| `AUTH_RESEND_KEY` | ✅ | ✅ | Resend API key (step 7). The worker reuses it for alert emails |
| `AUTH_EMAIL_FROM` | ✅ | – | `PriceVue <login@pricevue.in>` |
| `ALERTS_RESEND_KEY` | – | optional | Separate key for alert emails, if you want one |
| `ALERTS_EMAIL_FROM` | – | ✅ | `PriceVue Alerts <alerts@pricevue.in>` |
| `ADMIN_EMAILS` | ✅ | – | Your email(s), comma-separated, for `/admin/matches` |

`NEXT_PUBLIC_SITE_URL` is baked in at build time, so **redeploy** after changing it. Don't set `PGLITE_DATA_DIR` in production. Vercel's filesystem is temporary.

## 5. Point pricevue.in at Vercel (Hostinger DNS)

1. In Vercel: **Project → Settings → Domains → Add** `pricevue.in`. Accept the prompt to also add `www.pricevue.in`,
   and choose **redirect `www.pricevue.in` → `pricevue.in`**, so the apex is the canonical URL that matches
   `NEXT_PUBLIC_SITE_URL`.
2. Vercel then shows the exact records to create. **Always copy the values Vercel shows.** As of current Vercel docs,
   the apex uses an **A** record, and `www` uses a **project-specific CNAME** like `xxxxxxxx.vercel-dns-017.com`.
3. In Hostinger: **hPanel → Domains → pricevue.in → DNS / Nameservers → DNS records**:
   - **Delete** Hostinger's default parking records first: any `A` record for `@` and the `CNAME` for `www`. Also
     delete any `AAAA` record for `@`.
   - Add:

     | Type  | Name  | Points to / Target                                                       | TTL  |
     | ----- | ----- | ------------------------------------------------------------------------ | ---- |
     | A     | `@`   | The IP Vercel shows (currently `216.198.79.1`; the older `76.76.21.21` still works) | 3600 |
     | CNAME | `www` | The value Vercel shows (e.g. `xxxxxxxx.vercel-dns-017.com`; the older `cname.vercel-dns.com` still works) | 3600 |

   Hostinger doesn't offer ALIAS/ANAME at the apex, so use the A record. Keep Hostinger's nameservers. You don't need
   to move DNS to Vercel.
4. Wait until Vercel shows **Valid Configuration** for both domains (minutes to a few hours). Vercel then issues the SSL
   certificates automatically.

## 6. Google sign-in (OAuth)

1. <https://console.cloud.google.com> → create a project named `PriceVue`.
2. **APIs & Services → OAuth consent screen**: choose External. App name PriceVue, support email, authorised domain
   `pricevue.in`, privacy policy `https://pricevue.in/privacy`, terms `https://pricevue.in/terms`. Scopes: `email`,
   `profile`, `openid`. Then **Publish app**.
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorised JavaScript origins: `https://pricevue.in`
   - Authorised redirect URIs: `https://pricevue.in/api/auth/callback/google`
   - Optional, for testing before DNS is live: `https://<project>.vercel.app/api/auth/callback/google`, plus the same
     URL as a JavaScript origin.
4. Copy the Client ID and Secret into Vercel as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, then redeploy.

## 7. Resend (email)

1. Sign up at <https://resend.com> → **Domains → Add domain** `pricevue.in`. Pick the region closest to India
   (for example Tokyo, `ap-northeast-1`).
2. Resend shows the DNS records. Add each one in Hostinger **exactly as shown**. They usually look like this:

   | Type | Name                | Value                                                     | Priority |
   | ---- | ------------------- | --------------------------------------------------------- | -------- |
   | TXT  | `resend._domainkey` | `p=MIGfMA0…` (DKIM public key, copied from Resend)        | –        |
   | MX   | `send`              | `feedback-smtp.<region>.amazonses.com`                    | 10       |
   | TXT  | `send`              | `v=spf1 include:amazonses.com ~all`                       | –        |
   | TXT  | `_dmarc` (optional, recommended) | `v=DMARC1; p=none;`                          | –        |

   These are on the `send` subdomain, so they don't clash with any mailbox MX records on `@`.
3. Click **Verify** in Resend (it can take up to a few hours). Then **API Keys → Create** a key with *Sending access*
   for `pricevue.in`. Put it in `AUTH_RESEND_KEY` on **both** Vercel and Railway, and redeploy both.
4. Want to *receive* mail at `hello@pricevue.in` (used on the legal pages)? Set up Hostinger email or free forwarding.
   That adds MX records on `@`, which is fine.

## 8. Release routine

1. Merge to `main`. CI runs lint, typecheck, tests and build.
2. If the release adds files under `packages/db/drizzle/`, run **`db:migrate:prod`** (step 1) **before** the new code
   goes live.
3. Vercel deploys `main` automatically. Railway redeploys the worker automatically on push. You can turn that off and
   deploy manually if you prefer.

## Post-launch checklist

- [ ] `https://pricevue.in` loads with a valid padlock, and `https://www.pricevue.in` redirects to it.
- [ ] `https://pricevue.in/robots.txt` and `https://pricevue.in/sitemap.xml` load and list `https://pricevue.in/...` URLs.
- [ ] Share `https://pricevue.in` in WhatsApp or <https://www.opengraph.xyz> and confirm the preview image and title.
- [ ] Sign in with Google, and with an email magic link (check the email arrives and isn't in spam).
- [ ] Add a product to the watchlist and set an alert. Confirm the alert email arrives and its unsubscribe link works.
- [ ] Railway logs show `[deals]` and `[alerts]` lines every 15 minutes, with no repeated errors.
- [ ] Click a "Buy" link and confirm the Amazon URL contains `tag=pricevue-21`.
- [ ] Footer shows Privacy, Terms and Affiliate disclosure links, and the Amazon Associate disclosure text.
- [ ] `/admin/matches` works for you and returns 404 when signed out.
- [ ] Add the site to **Google Search Console** (DNS TXT verification in Hostinger) and submit `sitemap.xml`.
- [ ] Turn on spend/usage alerts in Vercel, Neon, Upstash and Railway.
- [ ] Amazon Associates: add `pricevue.in` to your website list in Associates Central, and make 3 qualifying sales
      within 180 days to keep the account.
