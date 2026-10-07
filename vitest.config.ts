import { defineConfig } from "vitest/config";

// Test the pure Catalogue module in isolation (node env). The client-view test
// opts into happy-dom via a `@vitest-environment` docblock.
export default defineConfig({
  test: {
    globals: true,
    // Default to the node environment; the client-view test opts into happy-dom
    // via a `@vitest-environment` docblock.
    include: ["src/**/*.{test,spec}.ts"],
  },
});
