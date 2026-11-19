import { existsSync } from "node:fs";
import path from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

interface DbHandle {
  db: Db;
  kind: "postgres" | "pglite";
  close: () => Promise<void>;
}

const globalForDb = globalThis as unknown as { __pricevueDb?: Promise<DbHandle> };

export function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  while (true) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

export function migrationsFolder(): string {
  return path.join(findRepoRoot(), "packages/db/drizzle");
}

export async function createPgliteDb(dataDir?: string): Promise<DbHandle> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema }) as unknown as Db;
  return { db, kind: "pglite", close: () => client.close() };
}

async function createHandle(): Promise<DbHandle> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(url, { max: 5 });
    return { db: drizzle(client, { schema }), kind: "postgres", close: () => client.end() };
  }
  const dir = process.env.PGLITE_DATA_DIR || path.join(findRepoRoot(), ".pglite");
  return createPgliteDb(dir);
}

export function getDbHandle(): Promise<DbHandle> {
  globalForDb.__pricevueDb ??= createHandle();
  return globalForDb.__pricevueDb;
}

export async function getDb(): Promise<Db> {
  return (await getDbHandle()).db;
}

export async function runMigrations(handle: DbHandle): Promise<void> {
  const migrationsDir = migrationsFolder();
  if (handle.kind === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(handle.db as any, { migrationsFolder: migrationsDir });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(handle.db, { migrationsFolder: migrationsDir });
  }
}
