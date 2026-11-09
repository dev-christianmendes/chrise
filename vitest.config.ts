import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

const webSrc = fileURLToPath(new URL("./apps/web/src", import.meta.url));

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["packages/core/src/**/*.ts", "packages/data/src/**/*.ts", "apps/web/src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.*",
        "**/*.d.ts",
        "apps/web/src/main.tsx",
        "apps/web/src/vite-env.d.ts",
        "apps/web/src/test/**",
      ],
      thresholds: {
        statements: 80,
        branches: 85,
        functions: 70,
        lines: 80,
      },
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["packages/*/src/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: { "@": webSrc } },
        test: {
          name: "web",
          environment: "jsdom",
          include: ["apps/web/src/**/*.test.{ts,tsx}"],
          setupFiles: ["apps/web/src/test/setup.ts"],
          css: false,
          restoreMocks: true,
          testTimeout: 10_000,
        },
      },
    ],
  },
});
