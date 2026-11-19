import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@pricevue/core", "@pricevue/db", "@pricevue/ui"],
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default config;
