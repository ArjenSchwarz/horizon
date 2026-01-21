import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { defineConfig, mergeConfig } from "vitest/config";

// Workers config for Cloudflare API tests
const workersConfig = defineWorkersConfig({
  test: {
    name: "workers",
    include: ["src/**/*.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});

// Node config for dashboard unit tests
const dashboardConfig = defineConfig({
  test: {
    name: "dashboard",
    include: ["dashboard/**/*.test.js"],
    environment: "node",
  },
});

export default mergeConfig(workersConfig, dashboardConfig);
