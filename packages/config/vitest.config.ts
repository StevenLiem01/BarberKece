import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use Node environment (no DOM needed for config/env tests)
    environment: "node",
    // Include test files
    include: ["src/**/*.test.ts"],
    // Resolve .js imports to .ts sources (NodeNext ESM interop for tests)
    resolve: {
      // Allow Vitest to find .ts source when import says .js
      extensionAlias: {
        ".js": [".ts", ".js"],
      },
    },
  },
});
