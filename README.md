# PriceVue

Price history and cross-store price comparison for India. Launch stores are Amazon.in and Flipkart, and the launch category is smartphones.

## Stack

- **pnpm + Turborepo** monorepo
- `apps/web`: Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, next-themes
- `apps/worker`: BullMQ workers (Redis) that refresh offers through store adapters
- `packages/core`: store adapter interface, Amazon/Flipkart URL parsers, affiliate link builder, variant-aware matcher, and pricing/history helpers
- `packages/db`: Drizzle ORM schema, migrations, seed data and queries (Postgres, or embedded PGlite locally)
- `packages/ui`: shared UI primitives (`cn`, Button, Badge, Card)

## Getting started

```bash
corepack enable   # or: npx pnpm@9.15.0 <cmd>
pnpm install
cp .env.example .env
pnpm db:setup     # migrate + seed (~1 year of INR price history)
pnpm dev          # http://localhost:3000
```

Leave `DATABASE_URL` unset to use an embedded PGlite database in `.pglite/`; no Docker is required. To use real Postgres and Redis instead:

```bash
docker compose up -d
export DATABASE_URL=postgres://pricevue:pricevue@localhost:5432/pricevue
pnpm db:setup
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | Run across all workspaces via Turborepo |
| `pnpm db:generate` | Generate SQL migrations from `packages/db/src/schema.ts` |
| `pnpm db:migrate` / `pnpm db:seed` | Apply migrations / reseed demo data |
| `pnpm db:migrate:prod` | Apply migrations to production Postgres (requires `DATABASE_URL`) |
| `pnpm --filter @pricevue/worker start` | Start the offer-refresh worker (re-detects deals after each snapshot) and 15-min deal sweep + price-alert email check (needs Redis) |

## Deploying

See [docs/DEPLOY.md](docs/DEPLOY.md) for the step-by-step launch guide (Vercel, Neon, Upstash, Railway, Hostinger DNS).

## Data model

`product → variant → store_listing → offer (current) → price_points`, plus `users`, `watchlists`, `alerts` and `deals`. All money is stored as integer **paise**.

**Deals** (`/deals`) are computed from each listing's own history (`packages/core/src/deals.ts`): the current price must be ≥ 3% below the lower of its 30- and 90-day medians, with at least 14 days of history. MRP is never used, so fake "off MRP" discounts don't qualify. Record lows (90-day / all-time) boost the score. Deals are upserted per listing and expired when the price recovers, the item goes out of stock or the offer goes stale.

## Stores and affiliates

- Store adapters implement `parseUrl`, `search`, `getListing` and `getOffer`, and declare capability flags (`packages/core/src/adapters`). New stores (Myntra, Ajio, Croma) plug into the same interface.
- **Amazon:** uses the Creators API through a stub until credentials are set (`AMAZON_CREATORS_API_*`). Every outbound Amazon link carries `tag=pricevue-21`, via `/go/[listingId]` → `buildAffiliateUrl`.
- **Flipkart:** polite page fetcher (real UA, per-host rate limit, retry with backoff, robots.txt) parsing JSON-LD with an embedded-state fallback; off by default for the worker (`FLIPKART_SCRAPER_ENABLED`). Ingest one URL with `pnpm --filter @pricevue/worker ingest <url> [--dry-run]`. Tests use HTML fixtures only and never scrape live.
- **Matching:** variant-aware (`packages/core/src/matcher.ts`). Titles are normalised (brand aliases, storage/RAM units, colour names, noise like "5G"/"(Renewed)"); sibling models (15 vs 15 Plus, 13 vs 13R) and brand/storage/RAM/colour conflicts are never merged. A shared EAN or model number links outright. `ingest` attaches a new listing to a variant scoring ≥ 0.9; otherwise it creates a new variant and queues candidates scoring ≥ 0.5 in `pending_matches` for review at `/admin/matches` (emails listed in `ADMIN_EMAILS`; others get a 404). Approve links the listing to the candidate; reject keeps it separate and the pair is never re-queued.

> As an Amazon Associate PriceVue earns from qualifying purchases.
