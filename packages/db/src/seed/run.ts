import { getDbHandle } from "../client";
import { seedDatabase } from "./seed";

const handle = await getDbHandle();
const result = await seedDatabase(handle.db);
console.log(`Seeded ${result.products} products, ${result.pricePoints} price points (${handle.kind}).`);
await handle.close();
