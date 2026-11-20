export async function register() {
  // Skip during `next build` (NODE_ENV is "production" there too); enforce when the server starts.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertProductionEnv, WEB_REQUIRED_ENV } = await import("@pricevue/core");
  assertProductionEnv("web", WEB_REQUIRED_ENV);
}
