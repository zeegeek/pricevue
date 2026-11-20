type Env = Record<string, string | undefined>;

export const WEB_REQUIRED_ENV = ["DATABASE_URL", "AUTH_SECRET", "NEXT_PUBLIC_SITE_URL"] as const;
export const WORKER_REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL", "NEXT_PUBLIC_SITE_URL"] as const;

/** Throws in production when any required variable is missing or blank; no-op elsewhere. */
export function assertProductionEnv(app: string, required: readonly string[], env: Env = process.env): void {
  if (env.NODE_ENV !== "production") return;
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length)
    throw new Error(`[${app}] Missing required environment variables in production: ${missing.join(", ")}. See docs/DEPLOY.md.`);
}
