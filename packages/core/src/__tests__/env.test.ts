import { describe, expect, it } from "vitest";
import { assertProductionEnv, WEB_REQUIRED_ENV } from "../env";

describe("assertProductionEnv", () => {
  it("is a no-op outside production", () => {
    expect(() => assertProductionEnv("web", WEB_REQUIRED_ENV, { NODE_ENV: "development" })).not.toThrow();
  });

  it("lists every missing or blank variable in production", () => {
    expect(() =>
      assertProductionEnv("web", WEB_REQUIRED_ENV, { NODE_ENV: "production", DATABASE_URL: "postgres://x", AUTH_SECRET: " " }),
    ).toThrow("AUTH_SECRET, NEXT_PUBLIC_SITE_URL");
  });

  it("passes when all are set", () => {
    const env = { NODE_ENV: "production", DATABASE_URL: "a", AUTH_SECRET: "b", NEXT_PUBLIC_SITE_URL: "c" };
    expect(() => assertProductionEnv("web", WEB_REQUIRED_ENV, env)).not.toThrow();
  });
});
