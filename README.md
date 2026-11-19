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
| `pnpm --filter @pricevue/worker start` | Start the offer-refresh worker (needs Redis) |

## Data model

`product → variant → store_listing → offer (current) → price_points`, plus `users`, `watchlists`, `alerts` and `deals`. All money is stored as integer **paise**.

## Stores and affiliates

- Store adapters implement `parseUrl`, `search`, `getListing` and `getOffer`, and declare capability flags (`packages/core/src/adapters`). New stores (Myntra, Ajio, Croma) plug into the same interface.
- **Amazon:** uses the Creators API through a stub until credentials are set (`AMAZON_CREATORS_API_*`). Every outbound Amazon link carries `tag=pricevue-21`, via `/go/[listingId]` → `buildAffiliateUrl`.
- **Flipkart:** polite page fetcher (real UA, per-host rate limit, retry with backoff, robots.txt) parsing JSON-LD with an embedded-state fallback; off by default for the worker (`FLIPKART_SCRAPER_ENABLED`). Ingest one URL with `pnpm --filter @pricevue/worker ingest <url> [--dry-run]`. Tests use HTML fixtures only and never scrape live.
- **Matching:** variant-aware. Brand, storage, RAM or colour conflicts are never merged, and only matches scoring ≥ 0.9 are treated as the same product.

> As an Amazon Associate PriceVue earns from qualifying purchases.
