import "server-only";
import { getDb } from "@pricevue/db";

export const db = () => getDb();
