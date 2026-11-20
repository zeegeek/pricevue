# Build from the repo root: docker build -f apps/worker/Dockerfile -t pricevue-worker .
FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
# Manifests first so the dependency layer is cached between code changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
# Dev dependencies are needed: the worker runs TypeScript via tsx.
RUN pnpm install --frozen-lockfile --filter "@pricevue/worker..."

COPY packages/core packages/core
COPY packages/db packages/db
COPY apps/worker apps/worker

ENV NODE_ENV=production \
    FLIPKART_SCRAPER_ENABLED=false
USER node
CMD ["pnpm", "--filter", "@pricevue/worker", "start"]
