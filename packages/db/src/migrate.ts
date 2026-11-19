import { getDbHandle, runMigrations } from "./client";

const handle = await getDbHandle();
await runMigrations(handle);
console.log(`Migrations applied (${handle.kind}).`);
await handle.close();
