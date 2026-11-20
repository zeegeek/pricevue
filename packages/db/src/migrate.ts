import { getDbHandle, runMigrations } from "./client";

// `--prod` refuses to fall back to the local PGlite database.
if (process.argv.includes("--prod") && !process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for production migrations. See docs/DEPLOY.md.");
  process.exit(1);
}

const handle = await getDbHandle();
await runMigrations(handle);
console.log(`Migrations applied (${handle.kind}).`);
await handle.close();
